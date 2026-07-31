export function reportError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  console.error("[Application Error]", error, context);
}