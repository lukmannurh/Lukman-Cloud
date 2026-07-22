---
name: self-healing-deploy-loop
description: Automate the loop of Code Fix -> Git Push -> Vercel Deployment Wait -> Multi-Device Playwright Audit -> Auto-Fix on Failure -> Re-audit until 100% Verified. Use this skill whenever you need to autonomously verify frontend deployments and auto-fix any bugs that arise in production environments.
---

# Self-Healing Deploy Loop

This skill enables agents to autonomously verify a production deployment (specifically on Vercel) using Playwright, and if any bugs or regressions are found, fix them in the source code, push to git, and re-run the loop until 100% verified.

## Workflow

When asked to run the self-healing deploy loop, execute the following steps meticulously:

### 1. Wait for Deployment
- If a push to `main` just occurred, wait 60-90 seconds using the `schedule` tool to ensure the Vercel deployment has finished building and propagating.

### 2. Multi-Device Playwright Audit
- You must use the `call_mcp_tool` for `playwright` to run tests on the target Vercel URL.
- Run tests on TWO viewports:
  - **Desktop**: 1280 x 800 (Use `browser_resize` or set viewport).
  - **Mobile**: 390 x 844 (Use `browser_resize` or set viewport).
- Use `browser_navigate` to load the deployed application (e.g. `https://lukman-cloud.vercel.app/`).
- Wait for page load completely.
- Perform visual or functional verification based on the requested Audit Scenarios (e.g., verifying single context menu behavior, upload widget persistence, and GB formatting).
- Take screenshots (`browser_take_screenshot`) of the results to verify visual state.

### 3. Verification & Analysis
- Examine the screenshots and the DOM (if needed via `browser_evaluate`) to determine if the Audit Scenarios pass.
- **Criteria for Failure**: If any UI element overlaps incorrectly, menus do not close as expected, or widgets linger when they should be hidden, the test FAILS.

### 4. Auto-Fix (Self-Healing)
- If a test FAILS, you MUST immediately:
  1. Identify the source code causing the failure.
  2. Implement a fix using code editing tools (`replace_file_content` / `multi_replace_file_content`).
  3. Verify `npm run build` compiles successfully.
  4. Run `git add .`, `git commit -m "fix: auto-resolved UI regression"`, `git push origin main`.
  5. Go back to Step 1 (Wait for deployment) and loop until all tests pass.

### 5. Final Report
- Once ALL scenarios pass, present the final screenshots to the user in the conversation or a walkthrough artifact, confirming the deployment is 100% verified.
