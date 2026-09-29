export type ActionResult =
  | { success: true; error?: never }
  | { success?: never; error: string };
