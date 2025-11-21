# Contributing to trusted-network-providers

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Adding New Providers](#adding-new-providers)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

This project follows a simple code of conduct:

- Be respectful and professional
- Focus on constructive feedback
- Help maintain a welcoming environment
- Report issues or concerns to the maintainers

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- Git
- Basic understanding of IP networking (CIDR notation, IPv4/IPv6)

### Setting Up Development Environment

1. **Fork and clone the repository:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/trusted-network-providers.git
   cd trusted-network-providers
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run tests to verify setup:**

   ```bash
   npm run test
   ```

4. **Update bundled assets (optional):**
   ```bash
   ./scripts/update-assets.sh
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-provider-xyz` - New features
- `fix/bug-description` - Bug fixes
- `docs/section-name` - Documentation updates
- `refactor/component-name` - Code refactoring

### Commit Messages

Follow conventional commit format:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test updates
- `chore:` - Maintenance tasks

**Examples:**

```
feat: add AWS CloudFront provider

fix: correct IPv6 range parsing in bunnynet provider

docs: update security best practices guide

refactor: replace while/pop loops with array.length=0
```

### Issue References

Reference issues in commit messages:

```
fix: correct array clearing bug in spf-analyser

Fixes #42. Changed provider.ipv4.ranges.pop() to
provider.ipv4.addresses.pop() on lines 163 and 169.
```

## Submitting Changes

### Pull Request Process

1. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clear, focused commits
   - Add tests for new functionality
   - Update documentation as needed
   - Follow coding standards (see below)

3. **Test thoroughly:**

   ```bash
   npm run test
   npm audit
   ```

4. **Update the issues tracker:**
   - Mark related checkboxes in `docs/issues.md`
   - Reference issue IDs in commits

5. **Push and create PR:**

   ```bash
   git push origin feature/your-feature-name
   ```

   - Use descriptive PR title
   - Explain changes in PR description
   - Link to related issues

6. **Address review feedback:**
   - Respond to comments
   - Make requested changes
   - Re-test after modifications

### Pull Request Checklist

Before submitting, ensure:

- [ ] Tests pass (`npm run test`)
- [ ] No security vulnerabilities (`npm audit`)
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commits are clean and well-organized
- [ ] Issue tracker updated (`docs/issues.md`)
- [ ] No commented-out code or debug statements

## Coding Standards

### JavaScript Style

- **Use modern JavaScript:** Prefer `const`/`let` over `var`
- **Arrow functions:** Use for callbacks and simple functions
- **Async/await:** Prefer over raw Promises for readability
- **String literals:** Use single quotes `'string'`
- **Semicolons:** Always use semicolons
- **Indentation:** 2 spaces (no tabs)

### Performance Considerations

- Avoid unbounded loops or recursion
- Cache parsed IP addresses when possible
- Use `array.length = 0` instead of `while().pop()`
- Profile performance-critical code

### Security Best Practices

- **HTTPS only:** All external requests must use HTTPS
- **Validate inputs:** Check IP address formats, CIDR notation
- **Resource limits:** Prevent memory exhaustion
- **Checksum verification:** Verify bundled asset integrity
- **Error handling:** Never expose sensitive information

See [docs/security.md](docs/security.md) for comprehensive guidelines.

### Constants and Magic Values

Use named constants for repeated strings:

```javascript
// Good
const IP_VERSION_V4 = 'ipv4';
if (version === IP_VERSION_V4) { ... }

// Avoid
if (version === 'ipv4') { ... }
```

### JSDoc Documentation

Document all public functions:

```javascript
/**
 * Brief description of what the function does.
 *
 * @param {string} paramName - Parameter description
 * @returns {boolean} Return value description
 *
 * @example
 * const result = myFunction('example');
 * console.log(result); // true
 */
myFunction: (paramName) => {
  // Implementation
};
```

## Adding New Providers

### Provider Structure

Create a new file in `src/providers/` following this template:

```javascript
/**
 * provider-name.js
 */

const self = {
  name: 'Provider Name',
  testAddresses: ['1.2.3.4', '2001:db8::1'],

  reload: () => {
    return new Promise((resolve, reject) => {
      // Load IP data (from API, DNS, file, etc.)
      // Update self.ipv4 and self.ipv6 arrays

      try {
        // Clear existing data
        self.ipv4.addresses.length = 0;
        self.ipv4.ranges.length = 0;
        self.ipv6.addresses.length = 0;
        self.ipv6.ranges.length = 0;

        // Populate with new data
        self.ipv4.ranges.push('1.2.3.0/24');

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  ipv4: {
    addresses: [],
    ranges: [],
  },

  ipv6: {
    addresses: [],
    ranges: [],
  },
};

module.exports = self;
```

### Provider Types

**Static Providers** (hardcoded ranges):

- No `reload` function needed
- Directly populate arrays in definition
- Example: `src/providers/private.js`, `src/providers/cloudflare.js`

**Bundled Asset Providers** (JSON files):

- Load from `src/assets/` directory
- Use checksum verification
- Example: `src/providers/googlebot.js`, `src/providers/bunnynet.js`

**HTTP API Providers** (external APIs):

- Use `secure-http-client.js` for HTTPS requests
- Implement structure validation
- Example: `src/providers/stripe-api.js`

**DNS-Based Providers** (SPF records):

- Use `spf-analyser.js` helper
- Be aware of DNSSEC limitations
- Example: `src/providers/google-workspace.js`

### Provider Checklist

When adding a provider:

- [ ] Create provider file in `src/providers/`
- [ ] Add to `defaultProviders` array in `src/index.js`
- [ ] Include at least 2 test addresses
- [ ] Document data source (URL, API, DNS record)
- [ ] Implement `reload()` if data is dynamic
- [ ] Add checksums for bundled assets
- [ ] Test with `npm run test`
- [ ] Update provider list in README.md
- [ ] Document in `docs/providers.md` (if it exists)

## Testing

### Running Tests

```bash
# Run full test suite
npm run test

# Check for security issues
npm audit

# Update assets and test
./scripts/update-assets.sh
npm run test
```

### Test Coverage

When adding features:

- Add test addresses to provider configuration
- Test both IPv4 and IPv6 addresses
- Test CIDR range matching
- Test error conditions
- Verify negative cases (IPs that shouldn't match)

### Integration Testing

Test your provider with realistic scenarios:

```javascript
const trustedProviders = require('./src/index');

// Load providers
trustedProviders.loadDefaultProviders();
await trustedProviders.reloadAll();

// Test your provider
const result = trustedProviders.getTrustedProvider('YOUR_TEST_IP');
console.assert(result === 'Your Provider Name', 'Provider match failed');
```

## Documentation

### What to Document

- **New features:** Update README.md and relevant docs
- **API changes:** Update JSDoc comments
- **Security changes:** Update docs/security.md
- **Known issues:** Update docs/issues.md
- **Breaking changes:** Note in CHANGELOG.md

### Documentation Structure

```
docs/
├── requirements.md       # Project specifications
├── implementation.md     # Technical architecture
├── security.md          # Security features and practices
├── issues.md            # Bug tracking and roadmap
└── dns-security-guide.md # DNS-specific security info
```

### Writing Documentation

- Use clear, concise language
- Include code examples
- Link to related documentation
- Keep examples up-to-date
- Use proper Markdown formatting

## Questions?

- **Issues:** [GitHub Issues](https://github.com/headwalluk/trusted-network-providers/issues)
- **Security:** Report privately to maintainers
- **General:** Open a discussion or issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to trusted-network-providers! 🎉
