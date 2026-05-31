import inspect
from app.agent import tools


def _invoke(tool, args, fake_db, user=None):
    payload = dict(args)
    params = inspect.signature(tool.func).parameters
    if "db" in params:
        payload["db"] = fake_db
    if "user" in params:
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


def test_check_compatibility_flags_socket_mismatch(fake_db):
    # 11 = AM5 CPU, 30 = AM5 board -> compatible
    ok = _invoke(tools.check_compatibility, {"component_ids": [11, 30]}, fake_db)
    assert ok["compatible"] is True
    assert ok["issues"] == []


def test_estimate_wattage_uses_specifications_tdp(fake_db):
    # 11 cpu tdp 120W, 20 gpu tdp 115W -> ~235W + headroom rounded to 50
    out = _invoke(tools.estimate_wattage, {"component_ids": [11, 20]}, fake_db)
    assert out["total_tdp"] == 235
    assert out["recommended_psu"] % 50 == 0
    assert out["recommended_psu"] >= 282  # 235 * 1.2


def test_check_bottleneck_balanced_pair(fake_db):
    out = _invoke(tools.check_bottleneck, {"cpu_id": 10, "gpu_id": 20}, fake_db)
    assert out["status"] in ("balanced", "cpu_bottleneck", "gpu_bottleneck")
    assert "severity" in out


def test_assemble_build_computes_total(fake_db):
    out = _invoke(tools.assemble_build, {
        "title": "Budget Gaming",
        "items": [{"slot": "cpu", "component_id": 10}, {"slot": "gpu", "component_id": 20}],
    }, fake_db)
    assert out["title"] == "Budget Gaming"
    assert out["total"] == 51000   # 21000 + 30000
    assert {i["slot"] for i in out["items"]} == {"cpu", "gpu"}


def test_save_build_requires_login(fake_db):
    out = _invoke(tools.save_build,
                  {"name": "x", "components": {"cpu": 10}}, fake_db, user=None)
    assert out["ok"] is False
    assert "log in" in out["message"].lower()


def test_save_build_persists_for_user(fake_db):
    out = _invoke(tools.save_build,
                  {"name": "My PC", "components": {"cpu": 10, "gpu": 20}},
                  fake_db, user={"id": "u1"})
    assert out["ok"] is True
    assert out["build"]["name"] == "My PC"


def test_registry_exposes_all_tools():
    names = set(tools.TOOL_MAP)
    assert {"search_components", "get_component", "check_compatibility",
            "estimate_wattage", "check_bottleneck", "assemble_build",
            "save_build", "create_share_link"} <= names
