/**
 * =============================================================================
 * MASTER SCRIPT: Run All Simulations (1-5) via V4 Universal Router
 * =============================================================================
 *
 * Runs all 5 simulations end-to-end with full workflow:
 *   0. Deploy
 *   1. Add Liquidity
 *   2. Set Tax Config
 *   2b. Test Before Fees (verify 0%) - V4 BUY, V2 SELL
 *   3. Set Pair (enable fees - IRREVERSIBLE)
 *   4. Test Buy (verify fees) - V4 Universal Router
 *   5. Test Sell (verify fees) - V4 Universal Router + Permit2
 *   6. Verify State
 *
 * All swaps use V4 Universal Router (0x6ff5693b99212da76ad316178a184ab56d299b43)
 * Sells require Permit2 (0x000000000022D473030F116dDEE9F6B43aC78BA3)
 *
 * Usage: npx hardhat run scripts/simulation/run_all_simulations.js --network fork
 *
 * =============================================================================
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SIMULATIONS = {
    1: { name: "AquariSim1", purpose: "Baseline - correct setup" },
    2: { name: "AquariSim2", purpose: "Wrong pair address test" },
    3: { name: "AquariSim3", purpose: "Wrong order (pair before fees)" },
    4: { name: "AquariSim4", purpose: "High fees (50%)" },
    5: { name: "AquariSim5", purpose: "Final rehearsal" },
};

const STEPS = [
    { script: "0_deploy.js", name: "Deploy" },
    { script: "1_add_liquidity.js", name: "Add Liquidity" },
    { script: "2_set_tax_config.js", name: "Set Tax Config" },
    { script: "2b_test_before_fees.js", name: "Test Before Fees" },
    { script: "3_set_pair.js", name: "Set Pair (Enable Fees)" },
    { script: "4_test_buy.js", name: "Test Buy" },
    { script: "5_test_sell.js", name: "Test Sell" },
    { script: "6_verify_state.js", name: "Verify State" },
];

const CONFIG_FILE = path.join(__dirname, "../config.js");
const STATE_FILE = path.join(__dirname, "../../deployments/simulation_state.json");
const REPORT_FILE = path.join(__dirname, "../../simulation_report.txt");

function updateActiveSimulation(simId) {
    let config = fs.readFileSync(CONFIG_FILE, "utf8");
    config = config.replace(
        /const ACTIVE_SIMULATION = \d+;/,
        `const ACTIVE_SIMULATION = ${simId};`
    );
    fs.writeFileSync(CONFIG_FILE, config);
    console.log(`  Config updated: ACTIVE_SIMULATION = ${simId}`);
}

function clearSimulationState(simId) {
    try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        state.simulations[simId] = {
            token: "",
            pair: "",
            deployed: false,
            lpAdded: false,
            feesEnabled: false,
        };
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        // State file doesn't exist, that's fine
    }
}

function runStep(script) {
    try {
        const output = execSync(
            `npx hardhat run scripts/simulation/${script} --network fork`,
            { encoding: "utf8", timeout: 120000 }
        );
        return { success: true, output };
    } catch (e) {
        return { success: false, output: e.stdout || e.message };
    }
}

function extractResult(output, stepName) {
    // Look for key indicators
    if (output.includes("FEES WERE APPLIED")) return "FEES APPLIED";
    if (output.includes("NO FEES")) return "NO FEES";
    if (output.includes("COMPLETE")) return "PASS";
    if (output.includes("Error") || output.includes("error")) return "ERROR";
    return "DONE";
}

function extractFeeAnalysis(output) {
    const analysis = {};

    // Extract expected fee
    const expectedMatch = output.match(/Expected Fee:\s+([\d.]+)%/);
    if (expectedMatch) analysis.expectedFee = expectedMatch[1];

    // Extract actual fee
    const actualMatch = output.match(/Actual Fee:\s+([\d.]+)%/);
    if (actualMatch) analysis.actualFee = actualMatch[1];

    // Extract precision loss
    const precisionMatch = output.match(/Precision Loss:\s+([\d.]+)%/);
    if (precisionMatch) analysis.precisionLoss = precisionMatch[1];

    // Extract burn split
    const burnMatch = output.match(/Burn Split:\s+([\d.]+)%/);
    if (burnMatch) analysis.burnSplit = burnMatch[1];

    // Extract foundation split
    const foundationMatch = output.match(/Foundation Split:\s+([\d.]+)%/);
    if (foundationMatch) analysis.foundationSplit = foundationMatch[1];

    // Extract total fees
    const totalFeesMatch = output.match(/Total Fees:\s+([\d.]+)/);
    if (totalFeesMatch) analysis.totalFees = totalFeesMatch[1];

    return Object.keys(analysis).length > 0 ? analysis : null;
}

async function main() {
    console.log("");
    console.log("=".repeat(80));
    console.log("            AQUARI SIMULATION - FULL TEST SUITE");
    console.log("=".repeat(80));
    console.log("");
    console.log("Running all 5 simulations with complete workflow...");
    console.log("");

    const results = {};
    let report = [];

    report.push("AQUARI SIMULATION REPORT");
    report.push("=" .repeat(60));
    report.push(`Date: ${new Date().toISOString()}`);
    report.push("");

    for (let simId = 1; simId <= 5; simId++) {
        const sim = SIMULATIONS[simId];
        results[simId] = { steps: {}, overall: "UNKNOWN" };

        console.log("");
        console.log("#".repeat(80));
        console.log(`#  SIMULATION ${simId}: ${sim.name}`);
        console.log(`#  Purpose: ${sim.purpose}`);
        console.log("#".repeat(80));
        console.log("");

        report.push("");
        report.push(`SIMULATION ${simId}: ${sim.name}`);
        report.push(`Purpose: ${sim.purpose}`);
        report.push("-".repeat(60));

        // Update config to use this simulation
        updateActiveSimulation(simId);
        clearSimulationState(simId);

        let allPassed = true;

        for (const step of STEPS) {
            console.log(`  [${simId}] Running ${step.name}...`);

            const result = runStep(step.script);
            const status = result.success ? extractResult(result.output, step.name) : "FAILED";

            results[simId].steps[step.script] = status;
            report.push(`  ${step.name}: ${status}`);

            // Extract and report fee analysis for buy/sell steps
            if ((step.script === "4_test_buy.js" || step.script === "5_test_sell.js") && result.success) {
                const feeAnalysis = extractFeeAnalysis(result.output);
                if (feeAnalysis) {
                    report.push(`    ├─ Expected: ${feeAnalysis.expectedFee || "N/A"}%`);
                    report.push(`    ├─ Actual:   ${feeAnalysis.actualFee || "N/A"}%`);
                    report.push(`    ├─ Precision Loss: ${feeAnalysis.precisionLoss || "N/A"}%`);
                    if (feeAnalysis.burnSplit) {
                        report.push(`    ├─ Burn Split: ${feeAnalysis.burnSplit}%`);
                    }
                    if (feeAnalysis.foundationSplit) {
                        report.push(`    └─ Foundation Split: ${feeAnalysis.foundationSplit}%`);
                    }
                }
            }

            if (!result.success) {
                console.log(`  [${simId}] ${step.name}: FAILED`);
                console.log(`       ${result.output.split("\n").slice(-3).join("\n       ")}`);
                allPassed = false;
                // Continue to next simulation
                break;
            } else {
                console.log(`  [${simId}] ${step.name}: ${status}`);
                // Show fee analysis in console for buy/sell
                if (step.script === "4_test_buy.js" || step.script === "5_test_sell.js") {
                    const feeAnalysis = extractFeeAnalysis(result.output);
                    if (feeAnalysis && feeAnalysis.actualFee) {
                        console.log(`       Fee: ${feeAnalysis.actualFee}% (expected ${feeAnalysis.expectedFee}%), precision loss: ${feeAnalysis.precisionLoss}%`);
                    }
                }
            }
        }

        results[simId].overall = allPassed ? "PASS" : "FAIL";
        report.push(`  OVERALL: ${results[simId].overall}`);

        console.log("");
        console.log(`  Simulation ${simId} ${results[simId].overall === "PASS" ? "PASSED" : "FAILED"}`);
    }

    // Summary
    console.log("");
    console.log("=".repeat(80));
    console.log("                         FINAL SUMMARY");
    console.log("=".repeat(80));
    console.log("");

    report.push("");
    report.push("=".repeat(60));
    report.push("FINAL SUMMARY");
    report.push("=".repeat(60));

    let passCount = 0;
    let failCount = 0;

    for (let simId = 1; simId <= 5; simId++) {
        const sim = SIMULATIONS[simId];
        const status = results[simId].overall;
        const icon = status === "PASS" ? "✓" : "✗";

        console.log(`  [${icon}] Simulation ${simId}: ${sim.name} - ${status}`);
        report.push(`  [${icon}] Simulation ${simId}: ${sim.name} - ${status}`);

        if (status === "PASS") passCount++;
        else failCount++;
    }

    console.log("");
    console.log(`  Total: ${passCount} passed, ${failCount} failed`);
    console.log("");

    report.push("");
    report.push(`Total: ${passCount} passed, ${failCount} failed`);

    // Save report
    fs.writeFileSync(REPORT_FILE, report.join("\n"));
    console.log(`Report saved to: ${REPORT_FILE}`);
    console.log("");

    // Reset to simulation 1
    updateActiveSimulation(1);

    if (failCount > 0) {
        console.log("Some simulations FAILED. Review the output above.");
        process.exit(1);
    } else {
        console.log("ALL SIMULATIONS PASSED!");
        process.exit(0);
    }
}

main().catch((e) => {
    console.error("Master script error:", e);
    process.exit(1);
});
