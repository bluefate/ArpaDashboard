import { config } from "./config.js";

/** OpenAPI 3.1 description of the ArpaDashboard HTTP API. */
export function buildOpenApiDocument() {
  const accentEnum = ["purple", "blue", "teal", "pink", "red", "green", "dark"];

  const serviceInput = {
    type: "object",
    required: ["name", "zone", "ip"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 63,
        description: "DNS label (hostname prefix)",
        example: "shop",
      },
      zone: {
        type: "string",
        description: `One of: ${config.allowedZones.join(", ")}`,
        example: "dev.home.arpa",
      },
      ip: {
        type: "string",
        format: "ipv4",
        example: "192.168.1.50",
      },
      port: {
        type: "integer",
        minimum: 1,
        maximum: 65535,
        example: 3333,
      },
      proxy: {
        type: "boolean",
        default: true,
        description:
          "If true, DNS points at CADDY_IP and the public URL uses the hostname; if false, DNS points at ip (direct).",
      },
      title: { type: "string", maxLength: 120, example: "Shop admin" },
      description: { type: "string", maxLength: 500 },
      group: {
        type: "string",
        maxLength: 80,
        description: "Dashboard category (e.g. Applications, Paused)",
        example: "Development",
      },
      tags: {
        type: "array",
        maxItems: 20,
        items: { type: "string", maxLength: 40 },
      },
      url_path: { type: "string", maxLength: 200, example: "/admin/" },
      protocol: { type: "string", enum: ["http", "https"], default: "https" },
      paused: { type: "boolean", default: false },
      accent: { type: "string", enum: accentEnum },
    },
  };

  const serviceRecord = {
    allOf: [
      { $ref: "#/components/schemas/ServiceInput" },
      {
        type: "object",
        required: ["id", "hostname", "dns_ip", "created_at", "updated_at"],
        properties: {
          id: { type: "string", format: "uuid" },
          hostname: { type: "string", example: "shop.dev.home.arpa" },
          dns_ip: { type: "string", format: "ipv4" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
          href: {
            type: "string",
            format: "uri",
            description: "Dashboard convenience URL (added on API responses)",
          },
        },
      },
    ],
  };

  const integrationResult = {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      skipped: { type: "boolean" },
      dryRun: { type: "boolean" },
      detail: { type: "string" },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "ArpaDashboard API",
      version: "0.1.0",
      description:
        "Register and manage `home.arpa` / `dev.home.arpa` / `test.home.arpa` services. " +
        "Write operations require `Authorization: Bearer <API_KEY>`. " +
        "When configured, create/update/delete also upsert or remove Pi-hole Local DNS and optional Caddy snippets.",
      contact: {
        name: "BlueFate Labs",
        url: "https://bluefatelabs.com/",
      },
      license: {
        name: "MIT",
        url: "https://github.com/bluefate/ArpaDashboard/blob/main/LICENSE",
      },
    },
    servers: [
      {
        url: "/api",
        description: "This ArpaDashboard instance",
      },
    ],
    tags: [
      { name: "Health", description: "Instance status and integration mode" },
      { name: "Services", description: "Service registry CRUD" },
      { name: "Docs", description: "OpenAPI documents" },
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Health and integration status",
          operationId: "getHealth",
          security: [],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Health" },
                },
              },
            },
          },
        },
      },
      "/openapi.json": {
        get: {
          tags: ["Docs"],
          summary: "OpenAPI document",
          operationId: "getOpenApi",
          security: [],
          responses: {
            "200": {
              description: "OpenAPI 3.1 JSON",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/services": {
        get: {
          tags: ["Services"],
          summary: "List services",
          operationId: "listServices",
          security: [],
          responses: {
            "200": {
              description: "Service list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["services"],
                    properties: {
                      services: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ServiceRecord" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Services"],
          summary: "Create or upsert a service",
          description:
            "Upserts by hostname (`name.zone`). Syncs Pi-hole Local DNS and optional Caddy snippet when configured.",
          operationId: "upsertService",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceInput" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated existing service",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpsertResponse" },
                },
              },
            },
            "201": {
              description: "Created new service",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UpsertResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/services/{id}": {
        get: {
          tags: ["Services"],
          summary: "Get one service",
          operationId: "getService",
          security: [],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Service",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["service"],
                    properties: {
                      service: { $ref: "#/components/schemas/ServiceRecord" },
                    },
                  },
                },
              },
            },
            "404": { $ref: "#/components/responses/Error" },
          },
        },
        patch: {
          tags: ["Services"],
          summary: "Patch a service",
          operationId: "patchService",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServicePatch" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MutationResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
          },
        },
        delete: {
          tags: ["Services"],
          summary: "Delete a service",
          operationId: "deleteService",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Deleted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["deleted", "service", "integrations"],
                    properties: {
                      deleted: { type: "boolean", example: true },
                      service: { $ref: "#/components/schemas/ServiceRecord" },
                      integrations: {
                        $ref: "#/components/schemas/Integrations",
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API_KEY",
          description:
            "Same value as the `API_KEY` environment variable. Click Authorize and paste the key (Swagger adds the Bearer prefix).",
        },
      },
      schemas: {
        ServiceInput: serviceInput,
        ServicePatch: {
          type: "object",
          description: "Partial ServiceInput — all fields optional",
          properties: serviceInput.properties,
        },
        ServiceRecord: serviceRecord,
        Health: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            zones: {
              type: "array",
              items: { type: "string" },
              example: config.allowedZones,
            },
            caddyIpConfigured: { type: "boolean" },
            dryRunIntegrations: { type: "boolean" },
            integrations: { type: "object" },
            pihole: { type: "boolean" },
            caddySnippet: { type: "boolean" },
          },
        },
        Integrations: {
          type: "object",
          properties: {
            dns: integrationResult,
            caddy: integrationResult,
          },
        },
        UpsertResponse: {
          type: "object",
          required: ["created", "service", "integrations"],
          properties: {
            created: { type: "boolean" },
            service: { $ref: "#/components/schemas/ServiceRecord" },
            integrations: { $ref: "#/components/schemas/Integrations" },
          },
        },
        MutationResponse: {
          type: "object",
          required: ["service", "integrations"],
          properties: {
            service: { $ref: "#/components/schemas/ServiceRecord" },
            integrations: { $ref: "#/components/schemas/Integrations" },
          },
        },
        ErrorBody: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
      responses: {
        Error: {
          description: "Error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorBody" },
            },
          },
        },
      },
    },
  };
}
