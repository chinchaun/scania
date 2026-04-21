# TypeScript ViewComfy API Example

This folder contains a small TypeScript example for calling the ViewComfy workflow API from [`main.ts`](./main.ts).

## Files

- `main.ts`: example script and reusable API helpers

## Install and run

From this folder:

```bash
npm install
npm run dev
```

The `dev` script compiles the project and then runs `main.ts`.

## What to edit in `main.ts`

Before running the script, update these constants in [`main.ts`](./main.ts):

```ts
const clientId = "your-client-id";
const clientSecret = "your-client-secret";
```

You can get the endpoint and API keys from your ViewComfy dashboard.

Then update the workflow parameters inside `generate()`:
supported values for now: 8.png 4.png 17.png 10.png

```ts
const params: Record<string, any> = {};
params["1660-inputs-image"] = "8.png";
```

The keys in `params` must match the parameter names expected by your deployed workflow. If they do not match, the API returns an error in `errorData`.

## How `main.ts` is structured

`main.ts` includes both reusable functions and an example entrypoint:

- `generate()`: runs an inference base on the parameters
- `getStatusByPromptIds(...)`: fetches prompt status by prompt id
- `cancel()`: cancels a running prompt

At the bottom of the file, `generate()` is executed by default:

```ts
generate().catch(console.error);
// cancel().catch(console.error);
// getStatusByPromptIds({ promptIds: ["your-prompt-id"] }).catch(console.error)
```


## Checking status

Use `getStatusByPromptIds()` to check one or more prompt ids:

```ts
const data = await getStatusByPromptIds({
  promptIds: ["your-prompt-id"],
});
```

This function:

- calls `GET /api/workflow/infer/`
- retries on `502` and `503`
- throws `"Token expired"` on `401` or `403`

## Response shape

The main response type is `IWorkflowHistoryModel`. The important fields are:

- `promptId`: unique prompt id
- `status`: current workflow status such as `scheduled`, `success`, or `error`
- `completed`: whether the run has finished
- `executionTimeSeconds`: total execution time
- `outputs`: generated files
- `errorData`: error message when the workflow fails

## The final state of an inference job
When a job has completed = True, it means it finished, the status can be success or error
When completed = False, the status can be scheduled or running

Example status values already shown in this repo:

- `scheduled`
- `success`
- `error`

Example response shapes:

Scheduled

```json
{
  "data": [
    {
      "promptId": "736ad068-3d7f-4291-9ff0-1ccd7436c0b3",
      "status": "scheduled",
      "completed": false,
      "executionTimeSeconds": 0,
      "prompt": {},
      "outputs": [],
      "createdAt": "2026-04-20T19:49:55.774304Z",
      "workflow": {},
      "clientId": "your-client-id",
      "user": null,
      "errorData": null
    }
  ]
}
```

Success

```json
{
  "data": [
    {
      "promptId": "736ad068-3d7f-4291-9ff0-1ccd7436c0b3",
      "status": "success",
      "completed": true,
      "executionTimeSeconds": 97.01,
      "prompt": {},
      "outputs": [
        {
          "id": 1,
          "filename": "output.png",
          "contentType": "image/png",
          "size": 123456,
          "filepath": "https://your-output-file"
        }
      ],
      "createdAt": "2026-04-20T19:49:55.774304Z",
      "workflow": {},
      "clientId": "your-client-id",
      "user": null,
      "errorData": null
    }
  ]
}
```

Error

```json
{
  "data": [
    {
      "promptId": "a1cf0676-bf6f-488e-9534-ccdcf8125e40",
      "status": "error",
      "completed": true,
      "executionTimeSeconds": 0,
      "prompt": {},
      "outputs": [],
      "createdAt": "2026-04-20T19:46:29.562106Z",
      "workflow": {},
      "clientId": "your-client-id",
      "user": null,
      "errorData": "Error parsing workflow params"
    }
  ]
}
```
