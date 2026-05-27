export function getErrorMessage(error: unknown, fallback = "İşlem başarısız oldu.") {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const candidate =
      getStringValue(record.message) ??
      getStringValue(record.error) ??
      getStringValue(record.reason) ??
      getStringValue(record.details);

    if (candidate) {
      return candidate;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
