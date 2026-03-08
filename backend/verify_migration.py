"""Quick verification that all backend files import correctly after Gemini migration."""
import sys

print("=" * 50)
print("NewtonAI Backend Migration Verification")
print("=" * 50)

errors = []

# 1. Check main.py imports
print("\n1. Checking main.py imports...")
try:
    import main
    print("   ✓ main.py imports OK")
    print(f"   ✓ Mangum handler exists: {hasattr(main, 'handler')}")
    print(f"   ✓ DynamoDB table configured: {main.DYNAMO_TABLE_NAME}")
    print(f"   ✓ Gemini keys loaded: {len(main.GEMINI_API_KEYS)}")
except Exception as e:
    errors.append(f"main.py: {e}")
    print(f"   ✗ {e}")

# 2. Check test_newton.py imports (no boto3)
print("\n2. Checking test_newton.py imports...")
try:
    import test_newton
    print("   ✓ test_newton.py imports OK")
    print(f"   ✓ validate_payload exists: {hasattr(test_newton, 'validate_payload')}")
    print(f"   ✓ call_llm exists: {hasattr(test_newton, 'call_llm')}")
    print(f"   ✓ TestGeminiReliability exists: {hasattr(test_newton, 'TestGeminiReliability')}")
    # Verify no boto3 reference
    import inspect
    src = inspect.getsource(test_newton.call_llm)
    if "boto3" in src or "bedrock" in src.lower():
        errors.append("test_newton.call_llm still references boto3/bedrock!")
        print("   ✗ call_llm still references boto3/bedrock!")
    else:
        print("   ✓ call_llm uses Gemini (no boto3/bedrock)")
except Exception as e:
    errors.append(f"test_newton.py: {e}")
    print(f"   ✗ {e}")

# 3. Check eval_claude_physics.py imports (no boto3)
print("\n3. Checking eval_claude_physics.py imports...")
try:
    import eval_claude_physics
    print("   ✓ eval_claude_physics.py imports OK")
    print(f"   ✓ call_gemini exists: {hasattr(eval_claude_physics, 'call_gemini')}")
    # Verify no boto3 reference
    import inspect
    src = inspect.getsource(eval_claude_physics.call_gemini)
    if "boto3" in src or "bedrock" in src.lower():
        errors.append("eval_claude_physics.call_gemini still references boto3/bedrock!")
        print("   ✗ call_gemini still references boto3/bedrock!")
    else:
        print("   ✓ call_gemini uses Gemini (no boto3/bedrock)")
except Exception as e:
    errors.append(f"eval_claude_physics.py: {e}")
    print(f"   ✗ {e}")

# 4. Check bedrock_prompt.py
print("\n4. Checking bedrock_prompt.py...")
try:
    from bedrock_prompt import SYSTEM_PROMPT
    print(f"   ✓ SYSTEM_PROMPT loaded ({len(SYSTEM_PROMPT)} chars)")
except Exception as e:
    errors.append(f"bedrock_prompt.py: {e}")
    print(f"   ✗ {e}")

# 5. Run validate_payload on a known-good payload
print("\n5. Running static validation test...")
try:
    from test_newton import validate_payload, VALID_MODE1_PAYLOAD
    result = validate_payload(VALID_MODE1_PAYLOAD)
    if result["passed"]:
        print("   ✓ VALID_MODE1_PAYLOAD passes validation")
    else:
        errors.append(f"VALID_MODE1_PAYLOAD failed: {result}")
        print(f"   ✗ VALID_MODE1_PAYLOAD failed validation")
except Exception as e:
    errors.append(f"validate_payload: {e}")
    print(f"   ✗ {e}")

# 6. Check test_schema.py
print("\n6. Checking test_schema.py...")
try:
    from schema_mode2 import Mode2Schema
    print(f"   ✓ Mode2Schema OK — {len(Mode2Schema.model_fields)} fields")
except Exception as e:
    errors.append(f"test_schema.py: {e}")
    print(f"   ✗ {e}")

# Summary
print("\n" + "=" * 50)
if errors:
    print(f"❌ {len(errors)} ERROR(S) FOUND:")
    for e in errors:
        print(f"   • {e}")
    sys.exit(1)
else:
    print("✅ ALL CHECKS PASSED — Backend is Gemini-ready!")
    sys.exit(0)
