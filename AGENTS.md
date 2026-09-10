# GroupRoute — Permanent Development Instructions

These rules apply to all tasks on this repository.

See detailed rules in [.agents/rules/grouproute_rules.md](file:///.agents/rules/grouproute_rules.md).

### Core Priorities:
- **WORKING PRODUCT > COMPLEX ARCHITECTURE**
- **CORRECTNESS > CLEVERNESS**
- **REAL DATA > FAKE DATA**
- **SIMPLE CODE > ENTERPRISE-LOOKING CODE**
- **REUSE > DUPLICATION**
- **SMALL CHANGE > LARGE REFACTOR**
- **EXPLAINABLE > IMPRESSIVE-LOOKING**
- **STABILITY > NEW FEATURES**

### Workflow for Every Task:
1. **Explain Before Coding**: State what is changing, what existing code is reused, and why this is the simplest safe approach.
2. **Reuse Existing Code**: Search existing controllers, services, stores, hooks, and utils before creating new ones.
3. **No Dead Code**: Remove unused imports, variables, and stale code.
4. **Test & Verify**: Run `npm test` and functional checks. Never claim success on build alone.
5. **Report**: Use the standardized final task report format with task type, modified files, reused code, tests performed, and build results.
