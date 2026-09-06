# Contributing to hireOS

Thanks for helping improve hireOS. Please keep changes focused and protect user data.

## Development

```bash
npm install
npm run build
npm run lint
npm test
```

Do not commit `.env`, API keys, OAuth secrets, service-role keys, access tokens,
uploaded resumes, Gmail exports, or production data. Use `.env.example` for
configuration documentation.

## Pull requests

Include:

- what changed and why;
- how the change was tested;
- migration or secret changes, if applicable;
- privacy and authorization implications for Gmail, resumes, or AI providers.

For parser changes, add fixtures or tests for both single-job messages and
multi-job digest messages. A malformed or incomplete record must never become a
confirmed job.
