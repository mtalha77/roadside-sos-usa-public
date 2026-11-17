/**
 * Third-party adapters (batch 4). One module per vendor, each with a real implementation and a
 * fake used in tests, local development, previews and demo mode. Screens and server code import
 * these, never a vendor SDK.
 */
export * from "./maps";
export * from "./twilio";
export * from "./voice";
export * from "./softphone";
export * from "./texting";
export * from "./analytics";
