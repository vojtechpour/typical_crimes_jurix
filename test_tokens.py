#!/usr/bin/env python3

import logging
from gemini_api import count_tokens

# Set up logging
logging.basicConfig(level=logging.DEBUG)

print("Testing Gemini token counting...")

# Test simple text
test_text = "Hello world, this is a test."
print(f"Test text: {test_text}")
print(f"Length: {len(test_text)} characters")

try:
    tokens = count_tokens(test_text)
    print(f"Tokens: {tokens}")
    print("✅ Token counting works!")
except Exception as e:
    print(f"❌ Error: {e}")

# Test longer text
longer_text = """
This is a longer test text to see how the token counting works.
It contains multiple sentences and should give us a better idea
of the token counting performance and reliability.
"""

print(f"\nTesting longer text ({len(longer_text)} characters)...")
try:
    tokens = count_tokens(longer_text)
    print(f"Tokens: {tokens}")
    print("✅ Longer text token counting works!")
except Exception as e:
    print(f"❌ Error: {e}")

print("\nTest complete!") 