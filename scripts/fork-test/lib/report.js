/**
 * =============================================================================
 * Test Report Generator
 * =============================================================================
 */

const fs = require("fs");
const path = require("path");
const { TEST_CATEGORIES } = require("../config");

class TestReport {
    constructor(mode, ctx) {
        this.mode = mode;
        this.signerAddress = ctx.signerAddress;
        this.tokenAddress = ctx.tokenAddress;
        this.proxyAddress = ctx.proxyAddress;
        this.implementationAddress = ctx.implementationAddress;
        this.pairAddress = ctx.pairAddress;
        this.ownerAddress = ctx.ownerAddress;
        this.foundationWallet = ctx.foundationWallet;
        this.startTime = new Date();
        this.blockNumber = null;
        this.results = [];
        this.gasUsage = {};
        this.warnings = [];
        this.scenarios = [];
    }

    setBlockNumber(blockNumber) {
        this.blockNumber = blockNumber;
    }

    addWarning(message) {
        this.warnings.push(message);
        console.log(`[WARN] ${message}`);
    }

    addScenarioResult(scenarioName, passed, details) {
        this.scenarios.push({ name: scenarioName, passed, details });
    }

    pass(testId, name, details = null, gasUsed = null) {
        const result = { status: "PASS", testId, name, details, gasUsed };
        this.results.push(result);

        let output = `[PASS] ${testId}: ${name}`;
        if (gasUsed) {
            output += ` (Gas: ${gasUsed.toLocaleString()})`;
            this.gasUsage[testId] = gasUsed;
        }
        console.log(output);

        if (details) {
            Object.entries(details).forEach(([k, v]) => {
                console.log(`       ${k}: ${v}`);
            });
        }
    }

    fail(testId, name, reason, details = null) {
        const result = { status: "FAIL", testId, name, reason, details };
        this.results.push(result);
        console.log(`[FAIL] ${testId}: ${name}`);
        console.log(`       Reason: ${reason}`);
        if (details) {
            Object.entries(details).forEach(([k, v]) => {
                console.log(`       ${k}: ${v}`);
            });
        }
    }

    skip(testId, name, reason) {
        const result = { status: "SKIP", testId, name, reason };
        this.results.push(result);
        console.log(`[SKIP] ${testId}: ${name}`);
        console.log(`       Reason: ${reason}`);
    }

    info(testId, name, details) {
        const result = { status: "INFO", testId, name, details };
        this.results.push(result);
        console.log(`[INFO] ${testId}: ${name}`);
        if (details) {
            Object.entries(details).forEach(([k, v]) => {
                console.log(`       ${k}: ${v}`);
            });
        }
    }

    getSummary() {
        const passed = this.results.filter(r => r.status === "PASS").length;
        const failed = this.results.filter(r => r.status === "FAIL").length;
        const skipped = this.results.filter(r => r.status === "SKIP").length;
        const info = this.results.filter(r => r.status === "INFO").length;

        // Count by severity
        const critical = this.results.filter(r => r.status === "FAIL" && r.severity === "CRITICAL").length;
        const high = this.results.filter(r => r.status === "FAIL" && r.severity === "HIGH").length;

        return {
            total: this.results.length,
            passed,
            failed,
            skipped,
            info,
            criticalFailures: critical,
            highFailures: high,
            totalGas: Object.values(this.gasUsage).reduce((a, b) => a + b, 0),
        };
    }

    getResultsByCategory() {
        const categories = {};
        for (const result of this.results) {
            // Extract category from test ID prefix
            let category = "other";
            if (result.testId.startsWith("PF")) category = "preflight";
            else if (result.testId.startsWith("S")) category = "security";
            else if (result.testId.startsWith("E")) category = "edge";
            else if (result.testId.startsWith("A")) category = "admin";
            else if (result.testId.startsWith("G")) category = "gas";
            else if (result.testId.startsWith("T")) {
                const num = parseInt(result.testId.slice(1));
                if (num <= 3) category = "access";
                else if (num <= 5) category = "config";
                else if (num <= 9) category = "trading";
                else if (num <= 11) category = "state";
                else category = "exclusion";
            }

            if (!categories[category]) categories[category] = [];
            categories[category].push(result);
        }
        return categories;
    }

    generate() {
        const summary = this.getSummary();
        const endTime = new Date();
        const duration = (endTime - this.startTime) / 1000;
        const categories = this.getResultsByCategory();

        const lines = [];
        const w = 80;

        // Header
        lines.push("╔" + "═".repeat(w - 2) + "╗");
        lines.push("║" + "AQUARI FEE ENABLEMENT - COMPREHENSIVE TEST REPORT".padStart((w + 48) / 2).padEnd(w - 2) + "║");
        lines.push("╚" + "═".repeat(w - 2) + "╝");
        lines.push("");

        // Meta info
        lines.push("┌" + "─".repeat(w - 2) + "┐");
        lines.push("│ TEST METADATA".padEnd(w - 2) + "│");
        lines.push("├" + "─".repeat(w - 2) + "┤");
        lines.push(`│  Mode:           ${this.mode.toUpperCase()}`.padEnd(w - 2) + "│");
        lines.push(`│  Date:           ${this.startTime.toISOString()}`.padEnd(w - 2) + "│");
        lines.push(`│  Duration:       ${duration.toFixed(2)}s`.padEnd(w - 2) + "│");
        lines.push(`│  Block Number:   ${this.blockNumber || "Unknown"}`.padEnd(w - 2) + "│");
        lines.push("└" + "─".repeat(w - 2) + "┘");
        lines.push("");

        // Accounts
        lines.push("┌" + "─".repeat(w - 2) + "┐");
        lines.push("│ ACCOUNTS".padEnd(w - 2) + "│");
        lines.push("├" + "─".repeat(w - 2) + "┤");
        lines.push(`│  Signer:         ${this.signerAddress}`.padEnd(w - 2) + "│");
        lines.push(`│  Contract Owner: ${this.ownerAddress}`.padEnd(w - 2) + "│");
        lines.push(`│  Foundation:     ${this.foundationWallet}`.padEnd(w - 2) + "│");
        lines.push("└" + "─".repeat(w - 2) + "┘");
        lines.push("");

        // Contracts
        lines.push("┌" + "─".repeat(w - 2) + "┐");
        lines.push("│ CONTRACTS (UUPS Proxy Pattern)".padEnd(w - 2) + "│");
        lines.push("├" + "─".repeat(w - 2) + "┤");
        lines.push(`│  Proxy:          ${this.proxyAddress}`.padEnd(w - 2) + "│");
        lines.push(`│  Implementation: ${this.implementationAddress}`.padEnd(w - 2) + "│");
        lines.push(`│  Pair:           ${this.pairAddress}`.padEnd(w - 2) + "│");
        lines.push("└" + "─".repeat(w - 2) + "┘");
        lines.push("");

        // Warnings
        if (this.warnings.length > 0) {
            lines.push("┌" + "─".repeat(w - 2) + "┐");
            lines.push("│ ⚠️  WARNINGS".padEnd(w - 2) + "│");
            lines.push("├" + "─".repeat(w - 2) + "┤");
            for (const warning of this.warnings) {
                lines.push(`│  • ${warning}`.padEnd(w - 2) + "│");
            }
            lines.push("└" + "─".repeat(w - 2) + "┘");
            lines.push("");
        }

        // Results by category
        const categoryOrder = ["preflight", "access", "security", "config", "trading", "state", "exclusion", "edge", "admin", "gas"];

        for (const cat of categoryOrder) {
            if (!categories[cat] || categories[cat].length === 0) continue;

            const catName = TEST_CATEGORIES[cat] || cat.toUpperCase();
            lines.push("┌" + "─".repeat(w - 2) + "┐");
            lines.push(`│ ${catName}`.padEnd(w - 2) + "│");
            lines.push("├" + "─".repeat(w - 2) + "┤");

            for (const r of categories[cat]) {
                const status = r.status === "PASS" ? "✓ PASS" :
                              r.status === "FAIL" ? "✗ FAIL" :
                              r.status === "SKIP" ? "○ SKIP" : "ℹ INFO";
                const gasStr = r.gasUsed ? ` (${r.gasUsed.toLocaleString()} gas)` : "";
                lines.push(`│  [${status}] ${r.testId}: ${r.name}${gasStr}`.padEnd(w - 2) + "│");

                if (r.reason) {
                    lines.push(`│           Reason: ${r.reason}`.slice(0, w - 2).padEnd(w - 2) + "│");
                }
                if (r.details) {
                    Object.entries(r.details).forEach(([k, v]) => {
                        const line = `│           ${k}: ${v}`;
                        lines.push(line.slice(0, w - 2).padEnd(w - 2) + "│");
                    });
                }
            }
            lines.push("└" + "─".repeat(w - 2) + "┘");
            lines.push("");
        }

        // Scenario Results
        if (this.scenarios.length > 0) {
            lines.push("┌" + "─".repeat(w - 2) + "┐");
            lines.push("│ SCENARIO RESULTS".padEnd(w - 2) + "│");
            lines.push("├" + "─".repeat(w - 2) + "┤");
            for (const s of this.scenarios) {
                const status = s.passed ? "✓" : "✗";
                lines.push(`│  [${status}] ${s.name}`.padEnd(w - 2) + "│");
                if (s.details) {
                    lines.push(`│      ${s.details}`.slice(0, w - 2).padEnd(w - 2) + "│");
                }
            }
            lines.push("└" + "─".repeat(w - 2) + "┘");
            lines.push("");
        }

        // Gas Summary
        if (Object.keys(this.gasUsage).length > 0) {
            lines.push("┌" + "─".repeat(w - 2) + "┐");
            lines.push("│ GAS USAGE SUMMARY".padEnd(w - 2) + "│");
            lines.push("├" + "─".repeat(w - 2) + "┤");
            for (const [testId, gas] of Object.entries(this.gasUsage)) {
                lines.push(`│  ${testId}: ${gas.toLocaleString()} gas`.padEnd(w - 2) + "│");
            }
            lines.push("├" + "─".repeat(w - 2) + "┤");
            lines.push(`│  TOTAL: ${summary.totalGas.toLocaleString()} gas`.padEnd(w - 2) + "│");
            lines.push("└" + "─".repeat(w - 2) + "┘");
            lines.push("");
        }

        // Final Summary
        lines.push("╔" + "═".repeat(w - 2) + "╗");
        lines.push("║ FINAL SUMMARY".padEnd(w - 2) + "║");
        lines.push("╠" + "═".repeat(w - 2) + "╣");
        lines.push(`║  Total Tests:    ${summary.total}`.padEnd(w - 2) + "║");
        lines.push(`║  Passed:         ${summary.passed} ✓`.padEnd(w - 2) + "║");
        lines.push(`║  Failed:         ${summary.failed} ✗`.padEnd(w - 2) + "║");
        lines.push(`║  Skipped:        ${summary.skipped} ○`.padEnd(w - 2) + "║");
        lines.push(`║  Info:           ${summary.info} ℹ`.padEnd(w - 2) + "║");
        lines.push("╠" + "═".repeat(w - 2) + "╣");

        if (summary.failed === 0 && summary.passed > 0) {
            lines.push("║".padEnd(w - 2) + "║");
            lines.push("║  ████  ALL TESTS PASSED  ████".padEnd(w - 2) + "║");
            lines.push("║".padEnd(w - 2) + "║");
            lines.push("║  ✓ Ready for mainnet execution".padEnd(w - 2) + "║");
            lines.push("║".padEnd(w - 2) + "║");
        } else if (summary.failed > 0) {
            lines.push("║".padEnd(w - 2) + "║");
            lines.push("║  ████  TESTS FAILED  ████".padEnd(w - 2) + "║");
            lines.push("║".padEnd(w - 2) + "║");
            lines.push("║  ✗ DO NOT proceed to mainnet".padEnd(w - 2) + "║");
            lines.push("║  ✗ Fix all failures first".padEnd(w - 2) + "║");
            lines.push("║".padEnd(w - 2) + "║");
        }

        lines.push("╚" + "═".repeat(w - 2) + "╝");

        return lines.join("\n");
    }

    save() {
        const reportDir = path.join(__dirname, "../reports");
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const timestamp = this.startTime.toISOString().replace(/[:.]/g, "-");
        const filename = `report-${this.mode}-${timestamp}.txt`;
        const filepath = path.join(reportDir, filename);

        const content = this.generate();
        fs.writeFileSync(filepath, content);

        // Also save JSON
        const jsonPath = filepath.replace(".txt", ".json");
        fs.writeFileSync(jsonPath, JSON.stringify({
            mode: this.mode,
            startTime: this.startTime.toISOString(),
            blockNumber: this.blockNumber,
            accounts: {
                signer: this.signerAddress,
                owner: this.ownerAddress,
                foundation: this.foundationWallet,
            },
            contracts: {
                proxy: this.proxyAddress,
                implementation: this.implementationAddress,
                pair: this.pairAddress,
            },
            warnings: this.warnings,
            summary: this.getSummary(),
            gasUsage: this.gasUsage,
            scenarios: this.scenarios,
            results: this.results,
        }, null, 2));

        return filepath;
    }

    print() {
        console.log("\n" + this.generate());
    }
}

module.exports = { TestReport };
