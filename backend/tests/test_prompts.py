from app.agent.prompts import SYSTEM_PROMPT


def test_system_prompt_sets_grounding_rules():
    p = SYSTEM_PROMPT.lower()
    assert "search_components" in p          # tells model to use tools
    assert "₹" in SYSTEM_PROMPT or "inr" in p  # India context
    assert "confirm" in p                    # confirm before write actions
