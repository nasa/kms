/**
 * Regular expression to match characters that are NOT allowed in a concept ID.
 * Allows only alphanumeric characters (a-z, A-Z, 0-9) and hyphens (-).
 */
export const conceptIdRegex = /[^a-zA-Z0-9-]/g

/**
 * Regular expression to match characters that are NOT allowed in a scheme ID.
 * Allows only letters (a-z, A-Z), hyphens (-), and underscores (_).
 */
export const schemeRegex = /[^a-zA-Z-_]/g

/**
 * Regular expression to validate and capture the base URL or namespace of an IRI.
 * Matches either HTTP/HTTPS URLs up to the final path segment ending with a slash,
 * excluding specific unsafe characters (<, >, quotes, braces, pipe, caret, backticks, backslashes),
 * or URN namespaces ending with a colon.
 */
export const baseRegex = /^(https?:\/\/[^\s<>"'{}|^`\\]+\/[^\s<>"'{}|^`\\]*\/|urn:[a-zA-Z0-9-:]+:)$/
