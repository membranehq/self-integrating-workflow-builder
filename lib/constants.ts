// Vercel deployment configuration
export const VERCEL_DEPLOY_URL =
  "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmembranehq%2Fself-integrating-workflow-builder&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%5D&env=BETTER_AUTH_SECRET,AI_GATEWAY_API_KEY,MEMBRANE_WORKSPACE_KEY,MEMBRANE_WORKSPACE_SECRET&envDescription=API%20keys%20needed%20for%20authentication%2C%20AI%20generation%2C%20and%20Membrane%20integrations";

// Vercel button URL for markdown
export const VERCEL_DEPLOY_BUTTON_URL = `[![Deploy with Vercel](https://vercel.com/button)](${VERCEL_DEPLOY_URL})`;
