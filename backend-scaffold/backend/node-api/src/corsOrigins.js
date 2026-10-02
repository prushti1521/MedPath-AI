const vercelPreviewOrigin = /^https:\/\/medpath-ai-frontend-project-[a-z0-9-]+-prushti\.vercel\.app$/i;

export function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin) || vercelPreviewOrigin.test(origin);
}