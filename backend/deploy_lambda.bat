REM NewtonAI Lambda Deployment Script
REM ═══════════════════════════════════════════════════════════════
REM  NewtonAI — Lambda Deployment Script
REM  Run this from: backend\
REM ═══════════════════════════════════════════════════════════════
setlocal enabledelayedexpansion

set FUNCTION_NAME=newton-ai-backend
set TABLE_NAME=newton_ai_sessions
set REGION=us-east-1
set ROLE_NAME=newton-ai-lambda-role
set API_NAME=newton-ai-api
set RUNTIME=python3.12
set TIMEOUT=60
set MEMORY=512

echo.
echo ═══════════════════════════════════════════════════════════════
echo  NewtonAI Lambda Deployment
echo ═══════════════════════════════════════════════════════════════

REM ── Step 1: Get AWS Account ID ──────────────────────────────────
echo.
echo [1/7] Getting AWS Account ID...
for /f "tokens=*" %%i in ('aws sts get-caller-identity --query Account --output text 2^>nul') do set ACCOUNT_ID=%%i
if "%ACCOUNT_ID%"=="" (
    echo ERROR: Could not get AWS Account ID. Make sure AWS CLI is configured.
    echo Run: aws configure
    exit /b 1
)
echo   Account ID: %ACCOUNT_ID%

REM ── Step 2: Create DynamoDB Table ───────────────────────────────
echo.
echo [2/7] Creating DynamoDB table: %TABLE_NAME%...
aws dynamodb describe-table --table-name %TABLE_NAME% --region %REGION% >nul 2>&1
if %errorlevel%==0 (
    echo   Table already exists - skipping.
) else (
    aws dynamodb create-table ^
        --table-name %TABLE_NAME% ^
        --attribute-definitions ^
            AttributeName=session_id,AttributeType=S ^
            AttributeName=timestamp,AttributeType=S ^
        --key-schema ^
            AttributeName=session_id,KeyType=HASH ^
            AttributeName=timestamp,KeyType=RANGE ^
        --billing-mode PAY_PER_REQUEST ^
        --region %REGION%
    echo   Table created (PAY_PER_REQUEST billing).
    echo   Waiting for table to become active...
    aws dynamodb wait table-exists --table-name %TABLE_NAME% --region %REGION%
    echo   Table is active.
)

REM ── Step 3: Create IAM Role ─────────────────────────────────────
echo.
echo [3/7] Creating IAM role: %ROLE_NAME%...

REM Create trust policy JSON
echo {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]} > trust-policy.json

aws iam get-role --role-name %ROLE_NAME% >nul 2>&1
if %errorlevel%==0 (
    echo   Role already exists - skipping creation.
) else (
    aws iam create-role ^
        --role-name %ROLE_NAME% ^
        --assume-role-policy-document file://trust-policy.json ^
        --region %REGION%
    echo   Role created.
)

REM Attach policies
echo   Attaching policies...
aws iam attach-role-policy --role-name %ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>nul
aws iam attach-role-policy --role-name %ROLE_NAME% --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess 2>nul
echo   Policies attached (Lambda basic + DynamoDB).

REM Wait for role propagation
echo   Waiting 10s for IAM role propagation...
timeout /t 10 /nobreak >nul

set ROLE_ARN=arn:aws:iam::%ACCOUNT_ID%:role/%ROLE_NAME%
echo   Role ARN: %ROLE_ARN%

del trust-policy.json 2>nul

REM ── Step 4: Package Lambda ──────────────────────────────────────
echo.
echo [4/7] Packaging Lambda deployment...

REM Clean previous builds
if exist lambda_package rmdir /s /q lambda_package
if exist lambda_deploy.zip del lambda_deploy.zip

mkdir lambda_package

REM Install dependencies into package folder
echo   Installing dependencies (this may take a minute)...
pip install -r requirements.txt -t lambda_package --quiet --upgrade

REM Copy application code
echo   Copying application code...
copy main.py lambda_package\ >nul
copy bedrock_prompt.py lambda_package\ >nul
copy schema.py lambda_package\ >nul
copy schema_mode2.py lambda_package\ >nul
copy .env lambda_package\ >nul

REM Create zip
echo   Creating deployment zip...
cd lambda_package
powershell -Command "Compress-Archive -Path * -DestinationPath ..\lambda_deploy.zip -Force"
cd ..

REM Check zip size
for %%A in (lambda_deploy.zip) do set ZIP_SIZE=%%~zA
set /a ZIP_MB=%ZIP_SIZE% / 1048576
echo   Package size: %ZIP_MB% MB

if %ZIP_MB% GTR 50 (
    echo   WARNING: Package is over 50MB. Consider using Lambda layers.
)

REM ── Step 5: Create/Update Lambda Function ───────────────────────
echo.
echo [5/7] Deploying Lambda function: %FUNCTION_NAME%...

REM Read API keys from .env
for /f "tokens=2 delims==" %%a in ('findstr "GEMINI_API_KEY_1=" .env') do set KEY1=%%a
for /f "tokens=2 delims==" %%a in ('findstr "GEMINI_API_KEY_2=" .env') do set KEY2=%%a

aws lambda get-function --function-name %FUNCTION_NAME% --region %REGION% >nul 2>&1
if %errorlevel%==0 (
    echo   Function exists - updating code...
    aws lambda update-function-code ^
        --function-name %FUNCTION_NAME% ^
        --zip-file fileb://lambda_deploy.zip ^
        --region %REGION%
    
    echo   Waiting for update to complete...
    aws lambda wait function-updated-v2 --function-name %FUNCTION_NAME% --region %REGION%
    
    echo   Updating configuration...
    aws lambda update-function-configuration ^
        --function-name %FUNCTION_NAME% ^
        --timeout %TIMEOUT% ^
        --memory-size %MEMORY% ^
        --environment "Variables={GEMINI_API_KEY_1=%KEY1%,GEMINI_API_KEY_2=%KEY2%,DYNAMO_TABLE_NAME=%TABLE_NAME%,AWS_REGION_OVERRIDE=%REGION%}" ^
        --region %REGION%
) else (
    echo   Creating new function...
    aws lambda create-function ^
        --function-name %FUNCTION_NAME% ^
        --runtime %RUNTIME% ^
        --role %ROLE_ARN% ^
        --handler main.handler ^
        --zip-file fileb://lambda_deploy.zip ^
        --timeout %TIMEOUT% ^
        --memory-size %MEMORY% ^
        --environment "Variables={GEMINI_API_KEY_1=%KEY1%,GEMINI_API_KEY_2=%KEY2%,DYNAMO_TABLE_NAME=%TABLE_NAME%,AWS_REGION_OVERRIDE=%REGION%}" ^
        --region %REGION%
    
    echo   Waiting for function to become active...
    aws lambda wait function-active-v2 --function-name %FUNCTION_NAME% --region %REGION%
)
echo   Lambda function deployed.

REM ── Step 6: Create API Gateway ──────────────────────────────────
echo.
echo [6/7] Setting up API Gateway: %API_NAME%...

REM Check if API already exists
for /f "tokens=*" %%i in ('aws apigatewayv2 get-apis --region %REGION% --query "Items[?Name=='%API_NAME%'].ApiId" --output text 2^>nul') do set API_ID=%%i

if defined API_ID (
    if not "%API_ID%"=="" (
        echo   API already exists: %API_ID% - skipping creation.
        goto :api_done
    )
)

REM Create HTTP API
for /f "tokens=*" %%i in ('aws apigatewayv2 create-api --name %API_NAME% --protocol-type HTTP --cors-configuration AllowOrigins=*,AllowMethods=*,AllowHeaders=* --region %REGION% --query ApiId --output text') do set API_ID=%%i
echo   API created: %API_ID%

REM Create Lambda integration
for /f "tokens=*" %%i in ('aws apigatewayv2 create-integration --api-id %API_ID% --integration-type AWS_PROXY --integration-uri arn:aws:lambda:%REGION%:%ACCOUNT_ID%:function:%FUNCTION_NAME% --payload-format-version 2.0 --region %REGION% --query IntegrationId --output text') do set INTEGRATION_ID=%%i
echo   Integration created: %INTEGRATION_ID%

REM Create catch-all route
aws apigatewayv2 create-route ^
    --api-id %API_ID% ^
    --route-key "$default" ^
    --target "integrations/%INTEGRATION_ID%" ^
    --region %REGION% >nul
echo   Route created ($default catch-all)

REM Create auto-deploy stage
aws apigatewayv2 create-stage ^
    --api-id %API_ID% ^
    --stage-name "$default" ^
    --auto-deploy ^
    --region %REGION% >nul
echo   Stage created (auto-deploy)

REM Grant API Gateway permission to invoke Lambda
aws lambda add-permission ^
    --function-name %FUNCTION_NAME% ^
    --statement-id apigateway-invoke ^
    --action lambda:InvokeFunction ^
    --principal apigateway.amazonaws.com ^
    --source-arn "arn:aws:execute-api:%REGION%:%ACCOUNT_ID%:%API_ID%/*" ^
    --region %REGION% >nul 2>&1
echo   Lambda permission granted.

:api_done

REM ── Step 7: Summary ─────────────────────────────────────────────
set API_URL=https://%API_ID%.execute-api.%REGION%.amazonaws.com

echo.
echo ═══════════════════════════════════════════════════════════════
echo  DEPLOYMENT COMPLETE!
echo ═══════════════════════════════════════════════════════════════
echo.
echo   Lambda:    %FUNCTION_NAME%
echo   DynamoDB:  %TABLE_NAME%
echo   API URL:   %API_URL%
echo.
echo  Test with:
echo   curl -X POST %API_URL%/generate -H "Content-Type: application/json" -d "{\"prompt\": \"show me a bouncing ball\"}"
echo.
echo  Health check:
echo   curl %API_URL%/health
echo.
echo  Update frontend API URL in App.tsx:
echo   Change: http://localhost:8000
echo   To:     %API_URL%
echo.

REM Cleanup
echo Cleaning up build artifacts...
if exist lambda_package rmdir /s /q lambda_package
echo Done!

endlocal
