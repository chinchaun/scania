import { promises as fs } from "fs";
import { v4 as uuidv4 } from 'uuid';

const API_URL = "https://api.viewcomfy.com"

function buildFormData(data: {
    params: Record<string, any>;
    overrideWorkflowApi?: Record<string, any> | undefined;
    prompt_id: string;
    viewComfyApiUrl: string;
}): FormData {
    const { params, overrideWorkflowApi, prompt_id, viewComfyApiUrl } = data;
    const formData = new FormData();
    const params_str: Record<string, any> = {};
    for (const key in params) {
        const value = params[key];
        if (value instanceof File) {
            formData.set(key, value);
        } else {
            params_str[key] = value;
        }
    }

    formData.set("params", JSON.stringify(params_str));
    formData.set("prompt_id", prompt_id);
    formData.set("view_comfy_api_url", viewComfyApiUrl);

    if (overrideWorkflowApi) {
        formData.set("workflow_api", JSON.stringify(overrideWorkflowApi));
    }

    return formData;
}

interface Infer {
    viewComfyApiUrl: string;
    params: Record<string, any>;
    overrideWorkflowApi?: Record<string, any> | undefined;
    clientId: string;
    clientSecret: string;
}

/**
 * Make an inference request to the viewComfy API
 *
 * @param viewComfyApiUrl - The URL to send the request to
 * @param params - The parameter to send to the workflow
 * @param overrideWorkflowApi - Optional override the default workflow_api of the deployment
 * @returns The parsed prompt result or null
 */
export const infer = async ({
    viewComfyApiUrl,
    params,
    overrideWorkflowApi,
    clientId,
    clientSecret,
}: Infer): Promise<IWorkflowHistoryModel> => {

    if (!viewComfyApiUrl) {
        throw new Error("viewComfyApiUrl is not set");
    }
    if (!clientId) {
        throw new Error("clientId is not set");
    }
    if (!clientSecret) {
        throw new Error("clientSecret is not set");
    }

    const prompt_id: string = uuidv4();
    const auth = {
        "client_id": clientId,
        "client_secret": clientSecret,
    };

    const formData = buildFormData({
        params,
        overrideWorkflowApi,
        viewComfyApiUrl,
        prompt_id,
    });

    const response = await fetch(`${API_URL}/api/workflow/infer`, {
        method: "POST",
        body: formData,
        redirect: "follow",
        headers: auth,
    });

    if (!response.ok) {
        const errMsg = `Failed to fetch viewComfy: ${response.statusText}, ${await response.text()}`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    const res = await response.json() as IWorkflowHistoryModel;
    return res;
};

export const inferCancel = async (args: {
    clientId: string;
    clientSecret: string;
    promptId: string;
    viewComfyApiUrl: string
}) => {

    const { promptId, viewComfyApiUrl, clientId, clientSecret } = args

    if (!viewComfyApiUrl) {
        throw new Error("viewComfyApiUrl is not set");
    }
    if (!clientId) {
        throw new Error("clientId is not set");
    }
    if (!clientSecret) {
        throw new Error("clientSecret is not set");
    }

    if (!promptId) {
        throw new Error("promptId is not set");
    }

    const headers = {
        "client_id": clientId,
        "client_secret": clientSecret,
        "content-type": "application/json"
    };

    try {
        const response = await fetch(`${API_URL}/api/workflow/infer/cancel`, {
            method: "POST",
            body: JSON.stringify({
                promptId,
                viewComfyApiUrl
            }),
            headers,
        });

        if (!response.ok) {
            console.error("something wen't wrong stopping your workflow");
            console.error(await response.text());
            return
        }

        const data = await response.json();
        console.log("workflow stopped")
        console.log({ data });
    } catch (error) {
        console.error("something wen't wrong stopping your workflow");
        console.error(error);
    }

}

/**
 * Represents the output file with a link to download the data from a prompt execution
 */
export interface S3FileData {
    filename: string;
    content_type: string;
    filepath: string;
    size: number;
}

/**
 * Creates a PromptResult object from the response
 *
 * @param data Raw prompt result data
 * @returns A properly formatted PromptResult with File objects
 */
export class PromptResult {
    /** Unique identifier for the prompt */
    prompt_id: string;

    /** Current status of the prompt execution */
    status: string;

    /** Whether the prompt execution is complete */
    completed: boolean;

    /** Time taken to execute the prompt in seconds */
    execution_time_seconds: number;

    /** The original prompt configuration */
    prompt: Record<string, any>;

    /** List of output files */
    outputs: S3FileData[];

    constructor(data: {
        prompt_id: string;
        status: string;
        completed: boolean;
        execution_time_seconds: number;
        prompt: Record<string, any>;
        outputs?: S3FileData[];
    }) {
        const {
            prompt_id,
            status,
            completed,
            execution_time_seconds,
            prompt,
            outputs = [],
        } = data;


        this.prompt_id = prompt_id;
        this.status = status;
        this.completed = completed;
        this.execution_time_seconds = execution_time_seconds;
        this.prompt = prompt;
        this.outputs = outputs;
    }
}

const viewComfyApiUrl = "https://viewcomfy--4714-4605-zyizrd-comfyui-infer.modal.run";
const clientId = "client_id";
const clientSecret = "client_secret";

const generate = async () => {
    try {

        // Advanced feature: overwrite default workflow with a new one:
        // https://github.com/ViewComfy/cloud-public/tree/main/ViewComfy_API#using-the-api-with-a-different-workflow
        const overrideWorkflowApiPath = null;

        const params: Record<string, any> = {};

        // Add your parameters here
        params["1660-inputs-image"] = "8.png"


        let overrideWorkflowApi = null;
        if (overrideWorkflowApiPath) {
            try {
                const fileContent = await fs.readFile(overrideWorkflowApiPath, "utf-8");
                overrideWorkflowApi = JSON.parse(fileContent);
            } catch (error) {
                console.error("Override workflow API path does not exist");
            }
        }

        // Call the API and get the logs of the execution in real time
        const result = await infer({
            viewComfyApiUrl,
            params,
            clientId,
            clientSecret,
            overrideWorkflowApi
        });

        console.log({ result });

    } catch (error: any) {
        console.error("Error:", error);
    }
};


async function saveBlob(blob: Blob, filename: string): Promise<void> {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filename, buffer);
}

const RETRYABLE_STATUS_CODES = [502, 503];
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export async function getStatusByPromptIds(params: {
    promptIds: string[];
}) {
    const { promptIds } = params;

    if (!promptIds || promptIds.length === 0) {
        throw new Error("promptIds cannot be empty or undefined")
    }

    const urlParams = `?${promptIds.map(id => `prompt_ids=${encodeURIComponent(id)}`).join('&')}`

    const url = `${API_URL}/api/workflow/infer/${urlParams}`;

    const headers = {
        "client_id": clientId,
        "client_secret": clientSecret,
        "content-type": "application/json"
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, {
            headers
        });

        if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)));
            continue;
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error("Token expired");
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json() as IWorkflowHistoryModel[];
        console.log({ data })
        return data
    }

    throw new Error("Max retries exceeded");
}

async function cancel() {
    const promptId = "<Prompt Id that you got from calling the generate function>";

    const result = await inferCancel({
        clientId,
        clientSecret,
        promptId,
        viewComfyApiUrl
    });
    console.log({ result });
}

generate().catch(console.error);
// cancel().catch(console.error);
// getStatusByPromptIds({ promptIds: [] }).catch(console.error)

export interface IBase {
    id: number;
    createdAt: Date;
}

export interface IWorkflowHistoryFileModel extends IBase {
    id: number;
    filename: string;
    contentType: string;
    size: number;
    filepath: string;
}

export interface IWorkflowHistoryWorkflowModel extends IBase {
    name: string;
}

export interface S3FilesData {
    filename: string;
    contentType: string;
    filepath: string;
    size: number;
}

export interface IWorkflowHistoryModel extends IBase {
    workflowId: number;
    promptId: string;
    status: string;
    completed: boolean;
    executionTimeSeconds: number;
    prompt: Record<string, unknown>;
    outputs: IWorkflowHistoryFileModel[] | undefined;
    workflow: IWorkflowHistoryWorkflowModel;
    createdAt: Date;
    errorData: string | undefined;
}
