# 3D Model Viewer - CLI Scaffolder Plan

## Overview
A Node.js CLI tool that scaffolds **new, independent repository instances** of the 3D model viewer configured for a specific GLB file, automatically sets up CI/CD, and deploys to Vercel.

**Goal**: One-command deployment of branded 3D viewers for individual models/customers.

---

## Phase 1: CLI Core (MVP)

### Command Structure
```bash
npx @metaphysicaljet/model-viewer-cli scaffold \
  --glb-url "https://github.com/user/repo/raw/main/model.glb" \
  --project-name "my-model-viewer" \
  --animations "assembly,exploded,detail" \
  --background "#ffffff" \
  --output "/path/to/output" \
  --deploy
```

### Implementation Steps

#### 1. **Project Scaffolder** (`lib/scaffold.ts`)
- Accept GLB URL and project metadata
- Validate GLB is accessible (HEAD request check)
- Clone/copy base template from `metaphysicaljet/model-viewer-template`
- Replace hardcoded values with CLI inputs

```typescript
interface ScaffoldOptions {
  glbUrl: string;           // URL to GLB file
  projectName: string;      // Output folder name
  displayName?: string;     // "My Car Viewer" (optional)
  animations?: string[];    // ["assembly", "exploded"] (optional)
  background?: string;      // "#ffffff" (optional)
  outputDir?: string;       // Where to create project
  deploy?: boolean;         // Auto-deploy to Vercel
  vercelToken?: string;     // Vercel API token (if deploy=true)
}
```

#### 2. **Template Repository**
Create a new GitHub repo: `metaphysicaljet/model-viewer-template`

**Structure**:
```
model-viewer-template/
├── src/
│   └── Viewer.tsx          (same as current Drone Viewer.tsx)
├── public/
│   └── template-config.json (placeholder config)
├── .github/
│   └── workflows/
│       └── deploy.yml      (same CI setup)
├── Dockerfile              (optional, for containerized docs)
├── vercel.json
├── package.json
├── tsconfig.json
└── README.md               (generated from template)
```

#### 3. **Configuration Generation** (`lib/gen-config.ts`)
Generate `public/models.json` with CLI inputs:

```typescript
function generateModelConfig(options: ScaffoldOptions): ModelConfig {
  return {
    name: options.displayName || options.projectName,
    modelPath: options.glbUrl,  // Use external URL directly
    background: options.background || '#fafafb',
    defaultAnimation: options.animations?.[0] || 'auto',
    animations: generateAnimationPresets(options.animations || []),
    lighting: DEFAULT_LIGHTING,
    camera: DEFAULT_CAMERA
  };
}

function generateAnimationPresets(
  animationNames: string[]
): Record<string, { camera: CameraPreset }> {
  // Smart preset generation based on animation names
  // E.g., 'exploded' → zoom out, 'detail' → zoom in
  return {
    [animationNames[0]]: { camera: PRESET_AUTO },
    ...animationNames.map(name => ({
      [name]: { camera: generateSmartPreset(name) }
    }))
  };
}
```

#### 4. **Git Repository Manager** (`lib/git-manager.ts`)
```typescript
interface GitManagerOptions {
  projectName: string;
  outputDir: string;
  gitHubToken?: string;  // To auto-create + push repo
}

class GitManager {
  async initRepo(options: GitManagerOptions): Promise<{
    localPath: string;
    remoteUrl?: string;
  }> {
    // 1. Initialize local git
    // 2. Add all files
    // 3. Initial commit: "Initial commit: [Project Name] 3D Viewer"
    // 4. Optionally create GitHub repo and push (if token provided)
  }
}
```

#### 5. **Vercel Deployer** (`lib/vercel-deployer.ts`)
```typescript
interface VercelDeployOptions {
  projectPath: string;
  projectName: string;
  vercelToken: string;
}

class VercelDeployer {
  async deploy(options: VercelDeployOptions): Promise<{
    projectId: string;
    deploymentUrl: string;
    productionUrl: string;
  }> {
    // 1. Create Vercel project using API
    // 2. Link to GitHub repo (if created)
    // 3. Trigger initial build
    // 4. Return production URL
  }
}
```

---

## Phase 2: Advanced Features

### Features to Add Later

#### 2.1 **Interactive Prompts** (if --interactive flag)
```bash
$ model-viewer-cli scaffold --interactive
? GitHub URL to GLB file: https://github.com/user/repo/raw/main/model.glb
? Project name: my-model-viewer
? Display name: My Custom Model
? Animation names (comma-separated): assembly,exploded,detail
? Background color [#fafafb]: 
? Deploy to Vercel? (Y/n): Y
? Vercel token: ***
```

#### 2.2 **Config Fine-Tuning** (post-scaffolding wizard)
```bash
$ model-viewer-cli configure ./my-model-viewer
? Adjust camera preset for 'assembly' animation?
? Current: position=[0,1.5,3.5], target=[0,0.5,0]
? New position (x,y,z): 0,2,4
```

#### 2.3 **Docker Image Export**
```bash
$ model-viewer-cli scaffold --glb-url ... --docker
→ Outputs: Dockerfile + docker-compose.yml
→ Ready for: `docker build -t my-viewer && docker run -p 3000:5173`
```

#### 2.4 **Environment Variable Support**
For CI/CD automation:
```bash
export GLB_URL=https://...
export PROJECT_NAME=my-viewer
export VERCEL_TOKEN=...
npx model-viewer-cli scaffold --from-env
```

#### 2.5 **Batch Scaffolding** (CSV input)
```bash
$ model-viewer-cli scaffold --batch models.csv
# models.csv:
# glb_url,project_name,display_name,animations
# https://...,model1,Model 1,assembly;exploded
# https://...,model2,Model 2,detail;inspection
```

---

## Phase 3: Enterprise Features

#### 3.1 **Custom Branding**
```bash
$ model-viewer-cli scaffold \
  --glb-url https://... \
  --branding logo.png,colors.json
```
- Inject logo into viewer UI
- Apply custom color themes (buttons, background, text)

#### 3.2 **Analytics Integration**
```bash
$ model-viewer-cli scaffold \
  --glb-url https://... \
  --analytics google,mixpanel
```
- Auto-inject tracking scripts
- Track model views, animation plays, camera interactions

#### 3.3 **Access Control**
```bash
$ model-viewer-cli scaffold \
  --glb-url https://... \
  --auth password|oauth
```
- Generate basic auth or OAuth2 integration
- Serve viewer behind authentication wall

---

## Implementation Roadmap

### Week 1: Core CLI
- [ ] Set up CLI package structure (`scaffold.ts`, `git-manager.ts`)
- [ ] Create template repository
- [ ] Implement project scaffolding + config generation
- [ ] Local testing (no Vercel integration yet)
- [ ] Publish to npm as `@metaphysicaljet/model-viewer-cli`

### Week 2: CI/CD Integration
- [ ] Implement `VercelDeployer` class
- [ ] Add `--deploy` flag and token handling
- [ ] Test end-to-end: CLI → local repo → Vercel deployment
- [ ] Generate README.md with custom docs for each project
- [ ] Update main viewer repo with CLI docs

### Week 3+: Advanced Features
- [ ] Interactive prompts
- [ ] Config fine-tuning post-scaffold
- [ ] Docker export
- [ ] Batch scaffolding from CSV

---

## File Structure (New Repo)

```
metaphysicaljet/model-viewer-cli/
├── src/
│   ├── cli.ts              (main entry point)
│   ├── commands/
│   │   ├── scaffold.ts     (scaffold command)
│   │   └── configure.ts    (adjust configs)
│   ├── lib/
│   │   ├── scaffold.ts     (scaffolder logic)
│   │   ├── config-gen.ts   (config generation)
│   │   ├── git-manager.ts  (git operations)
│   │   ├── vercel-deployer.ts (Vercel API)
│   │   └── validators.ts   (input validation)
│   └── templates/
│       └── (template files copied to output)
├── tests/
│   └── scaffold.test.ts
├── package.json
├── README.md
└── bin/
    └── index.js            (CLI entry point)
```

---

## Usage Examples (Final)

### Example 1: Simple Scaffolding
```bash
$ npx @metaphysicaljet/model-viewer-cli scaffold \
  --glb-url "https://raw.githubusercontent.com/user/repo/main/car.glb" \
  --project-name "car-viewer"

→ Creates: ./car-viewer/
→ Next: cd car-viewer && npm run dev
```

### Example 2: With Full Deployment
```bash
$ npx @metaphysicaljet/model-viewer-cli scaffold \
  --glb-url "https://my-bucket.s3.amazonaws.com/drone.glb" \
  --project-name "drone-viewer" \
  --display-name "Drone Assembly" \
  --animations "step_by_step,exploded_view,detail" \
  --deploy \
  --vercel-token "your-vercel-token"

→ Creates local repo
→ Pushes to GitHub (if token provided)
→ Deploys to Vercel
→ Returns: https://drone-viewer.vercel.app
```

### Example 3: Interactive Mode
```bash
$ npx @metaphysicaljet/model-viewer-cli scaffold --interactive

? Enter GitHub GLB URL: https://...
? Project name: my-model
? Animations (comma-separated, optional): assembly,exploded
? Deploy to Vercel? Y
? Vercel token: ***

→ Full automated setup
```

---

## Technical Considerations

### Error Handling
- Validate GLB URL accessibility before scaffolding
- Check Vercel token validity before deployment
- Graceful fallback if GitHub API fails
- Clear error messages with troubleshooting steps

### Performance
- Cache template repo locally (avoid repeated clones)
- Parallel: config generation + git init + dependency install
- Minimal npm install footprint (template uses same deps as base viewer)

### Security
- Store Vercel tokens securely (prompt user, don't log)
- Sanitize project names (no special chars, length limits)
- Validate GLB URLs (whitelist domains if needed)
- No credentials in generated repos

### Testing
- Unit tests for config generation logic
- Integration tests: scaffold → local build → verify output
- E2E test with mock Vercel API
- Test with sample GLB URLs (GitHub, S3, etc.)

---

## Dependencies

For NPM package:
```json
{
  "commander": "^11",              // CLI framework
  "chalk": "^5",                   // Colored output
  "ora": "^6",                     // Spinners
  "inquirer": "^9",                // Interactive prompts
  "node-fetch": "^3",              // HTTP requests
  "simple-git": "^3",              // Git operations
  "@vercel/sdk": "^1"              // Vercel API (if exists, else manual HTTP)
}
```

---

## Future: GitHub Action

Complement CLI with a GitHub Action:

```yaml
name: Deploy 3D Viewer
on:
  push:
    paths:
      - '3d-models/**/*.glb'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy 3D Viewer
        uses: metaphysicaljet/model-viewer-deploy@v1
        with:
          glb_file: './3d-models/model.glb'
          vercel_token: ${{ secrets.VERCEL_TOKEN }}
```

---

## Questions for Review

1. Should template live in a separate GitHub repo, or embedded in CLI package?
2. Should we auto-create GitHub repos, or just create locally + let user push manually?
3. Should the CLI read Vercel token from `~/.vercel` config, or prompt each time?
4. Should camera presets be "smart" (infer from animation names), or user-provided?
5. Should we support other GLB sources (S3, Google Cloud Storage, Azure Blob)?

---

## Success Criteria

✓ User can scaffold a new viewer for any GLB URL in < 2 minutes  
✓ Generated project is independent (can be shared, modified, deployed separately)  
✓ No manual file editing required for basic setup  
✓ Vercel deployment is automatic (if token provided)  
✓ Generated README docs are clear and specific to the model  
✓ CLI is published on npm and documented  
