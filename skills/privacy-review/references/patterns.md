# Privacy Check Patterns

## Sensitive Patterns Detected

### 1. Database URLs with Credentials

**Pattern**: `postgresql://[username:password@]host:port/database`

**Example**: `postgresql://docs_user:docs_pass@192.168.50.101:5432/docs`

**Why it's sensitive**:
- Exposes database username and password
- Can be used to access production data
- Often includes internal network addresses

**Fix**:
```bash
# Remove from history
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch config.py' HEAD

# Replace with environment variables
DATABASE_URL=os.getenv("DATABASE_URL")
```

### 2. API Keys

**Patterns**:
- `sk-[20-40 alphanumeric characters]` - OpenAI-style keys
- `AKIA[16 characters]` - AWS access keys
- `Bearer [20+ characters]` - Authorization tokens

**Examples**:
- `sk-abc123xyz...` (OpenAI)
- `AKIAXXXXXXXXXXXXXXXXX` (AWS)
- `Authorization: Bearer eyJhbGci...` (JWT)

**Why they're sensitive**:
- Provide direct access to cloud services
- Cannot be rotated easily if leaked
- Associated with billing and resource access

**Fix**:
```python
# Store in environment, not code
API_KEY=os.getenv("OPENAI_API_KEY")

# Or use secret management
from secret_manager import get_secret
API_KEY=get_secret("openai_key")
```

### 3. Secret Tokens

**Patterns**:
- `[a-zA-Z0-9._~+/-]{20,}` - Generic token pattern
- `secret="value"` - Secret assignments
- `token="value"` - Token assignments

**Examples**:
```javascript
token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
password="superSecret123"
```

**Why they're sensitive**:
- Provide authentication to services
- Often long-lived access credentials
- Can be intercepted in logs

**Fix**:
```python
# Use short-lived tokens
token=get_jwt_token()  # Generated at runtime, not stored

# Or use authentication flows
client=OAuth2Client()
```

### 4. Configuration Files

**Patterns**: Files with extensions like:
- `.env`
- `.pem` (SSL certificates)
- `.p12` (PKCS#12 certificates)
- `*_secrets.json`
- `*_credentials.json`

**Examples**:
```
.env                # Environment variables
service-account.json  # Google Cloud credentials
cert.pem            # SSL private key
```

**Why they're sensitive**:
- Contain all secrets for configuration
- Often checked into version control accidentally
- Provide complete access to systems

**Fix**:
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo "*.pem" >> .gitignore

# Remove from history if already committed
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' HEAD
```

## File Extension Checks

### High Risk Extensions

These file types should never be committed:

- `.env` / `.env.local` - Environment configuration
- `.pem` / `.key` - Private keys and certificates
- `.p12` / `.pfx` - Certificate bundles
- `*_secrets.*` - Secret configuration
- `*_credentials.*` - API credentials

### Medium Risk Extensions

These should be reviewed before committing:

- `.config` - Application config (may contain URLs, paths)
- `config.*.json` - JSON configuration files
- `settings.*.yml` - YAML settings files

## Git Protection Mechanisms

### .gitignore

Proper `.gitignore` entries:

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Secrets
*.pem
*.p12
*_secrets.*
*_credentials.*

# IDE
.vscode/
.idea/
```

### Repository Settings

Consider GitHub/GitLab protections:
- **Branch protection** - Require reviews for main branch
- **Secret scanning** - Enable automatic secret detection
- **Code owners** - Require approval for sensitive files

## Remediation Workflow

### If Secrets Are Found

1. **Immediate actions**:
   ```bash
   # Revoke exposed credentials
   # Change passwords immediately
   # Rotate API keys
   ```

2. **Remove from history**:
   ```bash
   # Remove file from all commits
   git filter-branch --force --index-filter \
     'git rm --cached --ignore-unmatch file-with-secrets.py' HEAD

   # Push cleaned history (requires force push)
   git push origin --force
   ```

3. **Update .gitignore**:
   ```bash
   # Add patterns to prevent future commits
   echo "config/*.json" >> .gitignore
   echo "*.key" >> .gitignore
   ```

### Preventing Future Leaks

**Pre-commit hooks**:
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Scan for secrets
if git diff --cached --name-only | grep -q '.env$'; then
  echo "ERROR: Attempting to commit .env file"
  exit 1
fi

# Scan for API keys
if git diff --cached | grep -qE '(sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})'; then
  echo "ERROR: Commit contains potential API key"
  exit 1
fi
```

**Secret scanning tools**:
- `truffleHog` - General secret scanner
- `gitleaks` - Git-specific scanner
- `git-secrets` - Pattern-based detection

## Best Practices

### Code Level

✅ **Do**:
- Use `os.getenv()` for all configuration
- Document required environment variables in `.env.example`
- Load secrets from secure vaults (AWS Secrets Manager, etc.)
- Validate secrets exist at startup, not in imports

❌ **Don't**:
- Hardcode database URLs with passwords
- Store API keys in version control
- Log secrets in print statements
- Commit configuration files with real values

### Repository Level

✅ **Do**:
- Use `.env.example` for template configuration
- Enable platform secret scanning (GitHub, GitLab)
- Require pull request reviews
- Set up branch protection rules

❌ **Don't**:
- Assume `.gitignore` prevents all commits
- Rely on human review alone
- Disable security features for convenience

### Workflow Level

✅ **Do**:
- Automate secret scanning in CI/CD
- Fail builds on secret detection
- Rotate credentials regularly
- Audit git history periodically

❌ **Don't**:
- Skip security checks for speed
- Allow manual overrides without review
- Ignore secret scanner warnings
