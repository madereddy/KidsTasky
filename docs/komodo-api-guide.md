# Komodo API & Deployment Guide

This guide documents the Komodo (komo.do) integration for KidsTasky. It covers configuration, available resources, and common API operations for rebuilding and redeploying the stack.

## 1. Environment Configuration

The following variables must be defined in the root `.env` file to authorize requests to the Komodo instance:

- `KOMODO_URL`: The base URL of the Komodo instance (e.g., `https://komodo.madereddy.com`).
- `KOMODO_API_KEY`: The API Key (Header: `X-Api-Key`).
- `KOMODO_API_KEY_SECRET`: The API Secret (Header: `X-Api-Secret`).

## 2. Project Resources

### Stacks
- `kidstasky`: The full stack deployment for KidsTasky.

## 3. API Operations

### Authentication
All requests require the following headers:
- `X-Api-Key`: Value from `KOMODO_API_KEY`
- `X-Api-Secret`: Value from `KOMODO_API_KEY_SECRET`
- `Content-Type`: `application/json`

### Common Endpoints

| Endpoint | Method | Description | Payload Example |
|----------|--------|-------------|-----------------|
| `/read/ListStacks` | POST | Returns all stacks and their status. | `{}` |
| `/execute/DeployStack` | POST | Triggers `docker compose pull && docker compose up -d` for a stack. | `{"stack": "kidstasky"}` |
| `/read/GetUpdate` | POST | Checks status of a background operation. | `{"id": "OPERATION_ID"}` |

## 4. Automation Snippets

### PowerShell (Trigger Deployment)
```powershell
$headers = @{
    "X-Api-Key" = $env:KOMODO_API_KEY
    "X-Api-Secret" = $env:KOMODO_API_KEY_SECRET
    "Content-Type" = "application/json"
}
$body = @{ "stack" = "kidstasky" } | ConvertTo-Json
$response = Invoke-RestMethod -Uri "$($env:KOMODO_URL)/execute/DeployStack" -Method Post -Headers $headers -Body $body
$response
```

## 5. Deployment Lifecycle

1. **GitHub Build**: Code is pushed to GitHub, which builds the `ghcr.io/madereddy/kidstasky:latest` image.
2. **Deploy**: Once the GitHub Action is finished, use `/execute/DeployStack` in Komodo to pull the latest image and restart the container.
3. **Verify**: Use `/read/ListStacks` to ensure the stack is running with the new image.
