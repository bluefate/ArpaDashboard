import { z } from "zod";

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const defaultZones = ["home.arpa", "dev.home.arpa", "test.home.arpa"];

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  apiKey: required("API_KEY", process.env.API_KEY),
  allowedZones: (process.env.ALLOWED_ZONES ?? defaultZones.join(","))
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean),
  caddyIp: process.env.CADDY_IP?.trim() || "",
  piholeUrl: process.env.PIHOLE_URL?.trim().replace(/\/$/, "") || "",
  piholePassword: process.env.PIHOLE_PASSWORD ?? "",
  caddySnippetPath: process.env.CADDY_SNIPPET_PATH?.trim() || "",
  dataPath: process.env.DATA_PATH?.trim() || "./data/services.json",
  dryRunIntegrations: bool(process.env.DRY_RUN_INTEGRATIONS, false),
};

export const ServiceInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i, "Invalid DNS label"),
  zone: z.string().min(1),
  ip: z.string().ip({ version: "v4" }),
  port: z.number().int().min(1).max(65535).optional(),
  proxy: z.boolean().default(true),
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  group: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  url_path: z.string().max(200).optional(),
  protocol: z.enum(["http", "https"]).default("https"),
  paused: z.boolean().default(false),
  accent: z
    .enum(["purple", "blue", "teal", "pink", "red", "green", "dark"])
    .optional(),
});

export const ServicePatchSchema = ServiceInputSchema.partial();

export type ServiceInput = z.infer<typeof ServiceInputSchema>;
export type ServicePatch = z.infer<typeof ServicePatchSchema>;

export type ServiceRecord = ServiceInput & {
  id: string;
  hostname: string;
  dns_ip: string;
  created_at: string;
  updated_at: string;
};

export function hostnameFor(name: string, zone: string): string {
  return `${name}.${zone}`.toLowerCase();
}

export function publicUrl(service: ServiceRecord): string {
  const path = service.url_path?.startsWith("/")
    ? service.url_path
    : service.url_path
      ? `/${service.url_path}`
      : "/";
  if (service.proxy) {
    return `${service.protocol}://${service.hostname}${path}`;
  }
  const port = service.port ? `:${service.port}` : "";
  return `${service.protocol}://${service.ip}${port}${path}`;
}
