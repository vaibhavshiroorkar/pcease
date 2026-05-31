from app.agent import tools


def _invoke(tool, args, fake_db, user=None):
    payload = dict(args)
    payload["db"] = fake_db
    if "user" in tool.args:
        payload["user"] = user
    return tool.invoke(payload)


def test_search_components_filters_by_category_and_budget(fake_db):
    out = _invoke(tools.search_components,
                  {"category": "cpu", "max_price": 25000}, fake_db)
    names = [c["name"] for c in out]
    assert "Ryzen 5 7600" in names          # 21000 <= 25000
    assert "Ryzen 7 7800X3D" not in names    # 38000 > 25000
    assert out[0]["lowest_price"] == 21000
    assert out[0]["best_vendor"] == "MDComputers"


def test_search_components_unknown_category_returns_empty(fake_db):
    assert _invoke(tools.search_components, {"category": "nope"}, fake_db) == []


def test_get_component_returns_full_specs(fake_db):
    out = _invoke(tools.get_component, {"component_id": 30}, fake_db)
    assert out["name"] == "MSI B650 Tomahawk"
    assert out["specifications"]["socket"] == "AM5"
