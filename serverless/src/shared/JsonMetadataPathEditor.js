import { hasAnyObjectValue, sequentialValueReplace } from './XmlMetadataPathEditor'

const ARRAY_INDEX_PATTERN = /^\d+$/

/**
 * Normalize optional text inputs so JSON comparisons and scalar writes behave consistently.
 *
 * @param {unknown} value Candidate value.
 * @returns {string} Trimmed string value or an empty string.
 */
const trimString = (value) => ((typeof value === 'string') ? value.trim() : '')

/**
 * Resolves the most useful scalar representation of a keyword object for leaf/scalar updates.
 *
 * @param {Record<string, unknown>} [keywordObject={}] Candidate keyword-style object.
 * @returns {string} Best scalar text representation for the update.
 */
const getScalarKeywordText = (keywordObject = {}) => {
  const preferredValue = [keywordObject.Value, keywordObject.ShortName]
    .map((value) => trimString(value))
    .find((value) => value.length > 0)

  if (preferredValue) {
    return preferredValue
  }

  return Object.values(keywordObject)
    .map((value) => trimString(value))
    .find((value) => value.length > 0) || ''
}

/**
 * Trims a keyword-style object down to the specific keys being compared so JSON matching stays
 * consistent even when callers provide extra fields or untrimmed values.
 *
 * @param {Record<string, unknown>|null|undefined} valueObject Candidate keyword-style object.
 * @param {string[]} valueKeys Ordered keys that matter for the current comparison.
 * @returns {Record<string, string>} Trimmed object containing only the requested keys.
 */
const normalizeValueObject = (valueObject, valueKeys) => valueKeys.reduce(
  (normalizedObject, valueKey) => ({
    ...normalizedObject,
    [valueKey]: trimString(valueObject?.[valueKey])
  }),
  {}
)

/**
 * True when the candidate path should be resolved from the JSON root document.
 *
 * @param {string} path Candidate JSON path.
 * @returns {boolean} Whether the path is absolute.
 */
const isAbsolutePath = (path) => typeof path === 'string' && path.startsWith('//')

/**
 * Converts slash-delimited JSON paths into normalized path segments.
 *
 * @param {string} path JSON path.
 * @returns {Array<string|number>} Normalized path segments.
 */
const toPathSegments = (path) => {
  const normalizedPath = path
    .replace(/^\/\//, '')
    .replace(/^\//, '')

  if (normalizedPath.length === 0) {
    return []
  }

  return normalizedPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => (ARRAY_INDEX_PATTERN.test(segment) ? Number(segment) : segment))
}

/**
 * True when the value can contain child paths.
 *
 * @param {unknown} value Candidate container.
 * @returns {boolean} Whether the value can hold nested properties/items.
 */
const isContainer = (value) => value !== null && typeof value === 'object'

/**
 * Determines whether the next path segment should live inside an array.
 *
 * @param {string|number|undefined} nextSegment Next path segment.
 * @returns {boolean} Whether the next container should be an array.
 */
const shouldCreateArrayForNextSegment = (nextSegment) => typeof nextSegment === 'number'

/**
 * JSON-native metadata editor that mirrors the XML path editor's correction contract.
 *
 * The public update APIs intentionally match `XmlMetadataPathEditor` where possible, while the
 * underlying traversal works with slash-delimited JSON paths.
 *
 * @example
 * const editor = new JsonMetadataPathEditor({
 *   Platforms: [
 *     {
 *       ShortName: 'Legacy Aqua'
 *     }
 *   ]
 * })
 *
 * editor.updateBlockNode({
 *   newKeywordObject: {
 *     ShortName: 'Aqua'
 *   }
 * }, {
 *   nodePath: '//Platforms/0',
 *   replace: [
 *     {
 *       fieldPath: 'ShortName',
 *       source: { type: 'value', key: 'ShortName' }
 *     }
 *   ]
 * })
 */
export class JsonMetadataPathEditor {
  /**
   * Builds a JSON-backed editor around a metadata payload.
   *
   * A deep clone is taken up front so callers can inspect the corrected result without mutating
   * their original input object.
   *
   * @param {unknown} metadataPayload Raw JSON metadata payload.
   */
  constructor(metadataPayload) {
    this.document = (typeof metadataPayload === 'undefined')
      ? undefined
      : structuredClone(metadataPayload)
  }

  /**
   * Serializes the current JSON document into a stable, readable string.
   *
   * @returns {string} Serialized JSON payload.
   */
  serialize() {
    return JSON.stringify(this.document, null, 2)
  }

  /**
   * Returns the child nodes for an object/array container.
   *
   * @param {unknown} node Candidate container node.
   * @returns {unknown[]} Child values.
   */
  getElementChildren(node) {
    if (Array.isArray(node)) {
      return node.slice()
    }

    if (isContainer(node)) {
      return Object.values(node)
    }

    return []
  }

  /**
   * Reads a direct child from an object/array container.
   *
   * @param {unknown} node Candidate parent container.
   * @param {string|number} segment Property name or array index.
   * @returns {unknown|null} Matching direct child value or `null`.
   */
  getDirectChildElement(node, segment) {
    if (!isContainer(node)) {
      return null
    }

    if (Array.isArray(node)) {
      return Number.isInteger(segment) ? (node[segment] ?? null) : null
    }

    return node[segment] ?? null
  }

  /**
   * Traverses a JSON field path beneath the provided node.
   *
   * Absolute paths resolve from the editor root. Relative paths resolve from the provided node.
   *
   * @param {unknown} node Starting node for relative traversal.
   * @param {string} fieldPath JSON field path.
   * @returns {unknown|null} Matching nested value or `null`.
   */
  getNestedElement(node, fieldPath) {
    if (typeof fieldPath !== 'string') {
      return null
    }

    const source = isAbsolutePath(fieldPath) ? this.document : node

    return toPathSegments(fieldPath).reduce(
      (currentNode, segment) => this.getDirectChildElement(currentNode, segment),
      source
    )
  }

  /**
   * Reads a scalar value from a JSON node.
   *
   * @param {unknown} node Candidate scalar node.
   * @returns {string} Trimmed scalar value or an empty string.
   */
  getElementText(node) {
    if (typeof node === 'string') {
      return trimString(node)
    }

    if (typeof node === 'number' || typeof node === 'boolean') {
      return String(node)
    }

    return ''
  }

  /**
   * Reads scalar text from a nested JSON field path.
   *
   * @param {unknown} node Starting node for relative traversal.
   * @param {string} fieldPath JSON field path.
   * @returns {string} Trimmed nested scalar value.
   */
  getNestedText(node, fieldPath) {
    return this.getElementText(this.getNestedElement(node, fieldPath))
  }

  /**
   * Reads ordered field values from a candidate JSON metadata node.
   *
   * @param {unknown} node Candidate metadata node.
   * @param {string[]} fieldPaths Ordered JSON field paths.
   * @returns {string[]} Segment values extracted from the node.
   */
  getNodeFieldValues(node, fieldPaths) {
    return fieldPaths.map((fieldPath) => this.getNestedText(node, fieldPath))
  }

  /**
   * Builds a keyword-style object from ordered JSON field paths on a node.
   *
   * @param {unknown} node Candidate metadata node.
   * @param {string[]} fieldPaths Ordered JSON field paths.
   * @param {string[]} valueKeys Ordered keyword-object keys.
   * @returns {Record<string, string>} Keyword-style object keyed by the provided value keys.
   */
  getNodeValueObject(node, fieldPaths, valueKeys) {
    return fieldPaths.reduce((keywordObject, fieldPath, index) => ({
      ...keywordObject,
      [valueKeys[index]]: this.getNestedText(node, fieldPath)
    }), {})
  }

  /**
   * Returns `true` when the field path should resolve from the document root.
   *
   * @param {string} fieldPath Candidate field path.
   * @returns {boolean} Whether the path is absolute.
   */
  isAbsoluteFieldPath(fieldPath) {
    return isAbsolutePath(fieldPath)
  }

  /**
   * Selects JSON nodes using a simple path contract.
   *
   * When the resolved target is an array, each array item is returned as a candidate node. This
   * mirrors how repeated XML block paths return one node per matched element.
   *
   * @param {string} path JSON path to resolve.
   * @param {unknown} [contextNode=this.document] Context node for relative paths.
   * @returns {unknown[]} Matching candidate nodes.
   */
  selectNodes(path, contextNode = this.document) {
    return this.selectNodeEntries(path, contextNode).map(({ node }) => node)
  }

  /**
   * Resolves an absolute `//Root/Child/...` JSON path beneath an existing document root key.
   *
   * Unlike generic root-level JSON writes, this mirrors the XML editor's contract by only
   * creating missing descendants when the requested root key already exists on the document.
   *
   * @param {string} fieldPath Absolute JSON path.
   * @param {Object} [options={}] Absolute-path resolution options.
   * @param {boolean} [options.createIfMissing=false] Create missing descendants beneath the root.
   * @returns {{node: unknown, parent: unknown, key: string|number|null, path: Array<string|number>}|null}
   * Matching or newly creatable absolute target entry.
   */
  resolveAbsoluteFieldEntry(fieldPath, { createIfMissing = false } = {}) {
    if (typeof fieldPath !== 'string' || !this.isAbsoluteFieldPath(fieldPath) || !isContainer(this.document)) {
      return null
    }

    const [rootSegment, ...childSegments] = toPathSegments(fieldPath)
    if (typeof rootSegment === 'undefined') {
      return null
    }

    const rootEntry = this.resolveEntryForSegments(this.document, [rootSegment])
    if (!rootEntry) {
      return null
    }

    if (childSegments.length === 0) {
      return rootEntry
    }

    return createIfMissing
      ? this.ensureEntryForSegments(rootEntry.node, childSegments)
      : this.resolveEntryForSegments(rootEntry.node, childSegments)
  }

  /**
   * Writes a scalar value to a nested JSON field path, creating missing containers as needed.
   *
   * @param {unknown} node Starting node for relative paths.
   * @param {string} fieldPath JSON field path.
   * @param {string} value Replacement scalar value.
   */
  setNestedText(node, fieldPath, value) {
    if (typeof fieldPath !== 'string') {
      return
    }

    if (this.isAbsoluteFieldPath(fieldPath)) {
      const target = this.resolveAbsoluteFieldEntry(fieldPath, { createIfMissing: true })

      if (target) {
        this.setEntryValue(target, value)
      }

      return
    }

    const source = node
    const segments = toPathSegments(fieldPath)

    if (!isContainer(source) || segments.length === 0) {
      return
    }

    const target = this.ensureEntryForSegments(source, segments)
    if (!target) {
      return
    }

    this.setEntryValue(target, value)
  }

  /**
   * Removes a nested JSON field/item when it exists.
   *
   * @param {unknown} node Starting node for relative paths.
   * @param {string} fieldPath JSON field path.
   */
  removeNestedElement(node, fieldPath) {
    if (typeof fieldPath !== 'string') {
      return
    }

    const source = this.isAbsoluteFieldPath(fieldPath) ? this.document : node
    const segments = toPathSegments(fieldPath)

    if (!isContainer(source) || segments.length === 0) {
      return
    }

    const target = this.resolveEntryForSegments(source, segments)
    if (!target) {
      return
    }

    this.removeEntry(target)
  }

  /**
   * Resolves the replacement value for a configured JSON field from correction input.
   *
   * Source configs can read directly from the correction payload (`param`), from the normalized
   * replacement keyword object (`value`), or compute a composed value dynamically (`computed`).
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} [sourceConfig={}] Source selection rules for the replacement value.
   * @param {unknown} [targetNode=null] Matched JSON node being updated.
   * @returns {string} Replacement value to write into the JSON field.
   */
  getReplacementValue(correction, sourceConfig = {}, targetNode = null) {
    if (sourceConfig.type === 'param') {
      return trimString(correction?.[sourceConfig.key])
    }

    if (sourceConfig.type === 'value') {
      return trimString(correction?.newKeywordObject?.[sourceConfig.key])
    }

    if (sourceConfig.type === 'computed' && typeof sourceConfig.getValue === 'function') {
      return trimString(sourceConfig.getValue({
        correction,
        editor: this,
        targetNode,
        sourceConfig
      }))
    }

    return ''
  }

  /**
   * Locates the JSON node that corresponds to the current keyword value being corrected.
   *
   * If no explicit `find` config is provided and the resolved path yields exactly one candidate,
   * that node is treated as an exact targeted match.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific node find configuration.
   * @returns {unknown|null} Matching JSON node or `null` when no current value matches.
   */
  resolveNodeByFind(correction, config) {
    return this.resolveNodeEntryByFind(correction, config)?.node ?? null
  }

  /**
   * Applies a replace/delete correction to a repeated object-style JSON node.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @returns {boolean} `true` when a node was matched and changed.
   */
  updateBlockNode(correction, config) {
    const action = trimString(String(correction.action || 'replace')).toLowerCase()
    const targetEntry = this.resolveNodeEntryByFind(correction, config)
    if (!targetEntry) {
      return false
    }

    if (action === 'delete') {
      this.removeEntry(targetEntry)

      if (typeof config.afterDelete === 'function') {
        config.afterDelete(this, targetEntry.node)
      }

      return true
    }

    if (action === 'replace') {
      config.replace.forEach(({ fieldPath, source }) => {
        const value = this.getReplacementValue(correction, source, targetEntry.node)

        if (value.length > 0) {
          this.setNestedText(targetEntry.node, fieldPath, value)
        } else {
          this.removeNestedElement(targetEntry.node, fieldPath)
        }
      })

      if (
        config.removeNodeIfEmptyAfterReplace
        && this.getElementChildren(targetEntry.node).length === 0
      ) {
        this.removeEntry(targetEntry)
      }

      if (typeof config.afterReplace === 'function') {
        config.afterReplace(this, targetEntry.node)
      }

      return true
    }

    return false
  }

  /**
   * Applies a replace/delete correction to a simple leaf JSON node.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @returns {boolean} `true` when a node was matched and changed.
   */
  updateLeafNode(correction, config) {
    const action = trimString(String(correction.action || 'replace')).toLowerCase()
    const targetEntry = this.resolveNodeEntryByFind(correction, config)
    if (!targetEntry) {
      return false
    }

    if (action === 'delete') {
      const { parent } = targetEntry
      this.removeEntry(targetEntry)

      if (config.removeEmptyParent && this.getElementChildren(parent).length === 0) {
        const parentEntry = (typeof config.parentPath === 'string')
          ? this.resolveNodeEntryByPath(config.parentPath)
          : this.resolveEntryForSegments(this.document, targetEntry.path.slice(0, -1))
        if (parentEntry) {
          this.removeEntry(parentEntry)
        }
      }

      return true
    }

    if (action === 'replace') {
      const value = getScalarKeywordText(correction?.newKeywordObject)
      this.setEntryValue(targetEntry, value)

      return true
    }

    return false
  }

  /**
   * Applies a replace/delete correction to a single scalar JSON field.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific mutation configuration.
   * @param {string} config.nodePath JSON path for the scalar field.
   * @returns {boolean} `true` when the scalar field was changed.
   */
  updateScalarNode(correction, config) {
    const action = trimString(String(correction.action || 'replace')).toLowerCase()
    if (typeof config.nodePath !== 'string' || config.nodePath.length === 0) {
      return false
    }

    const targetEntry = this.resolveNodeEntryByPath(config.nodePath)

    if (action === 'delete') {
      if (!targetEntry) {
        return false
      }

      this.removeEntry(targetEntry)

      return true
    }

    if (action === 'replace') {
      const value = getScalarKeywordText(correction?.newKeywordObject)
      if (value.length === 0) {
        return false
      }

      if (targetEntry) {
        this.setEntryValue(targetEntry, value)
      } else {
        if (!isContainer(this.document)) {
          return false
        }

        const createdEntry = this.isAbsoluteFieldPath(config.nodePath)
          ? this.resolveAbsoluteFieldEntry(config.nodePath, { createIfMissing: true })
          : this.ensureEntryForSegments(
            this.document,
            toPathSegments(config.nodePath)
          )
        if (!createdEntry) {
          return false
        }

        this.setEntryValue(createdEntry, value)
      }

      return true
    }

    return false
  }

  /**
   * Returns candidate node entries for the given JSON path.
   *
   * Array targets are expanded into one entry per array item so repeated JSON blocks behave like
   * repeated XML nodes.
   *
   * @param {string} path JSON path to resolve.
   * @param {unknown} [contextNode=this.document] Context node for relative paths.
   * @returns {Array<{node: unknown, parent: unknown, key: string|number|null, path: Array<string|number>}>}
   * Candidate node entries.
   */
  selectNodeEntries(path, contextNode = this.document) {
    if (typeof path !== 'string') {
      return []
    }

    const source = this.isAbsoluteFieldPath(path) ? this.document : contextNode
    const segments = toPathSegments(path)

    if (typeof source === 'undefined') {
      return []
    }

    if (segments.length === 0) {
      return [{
        node: source,
        parent: null,
        key: null,
        path: []
      }]
    }

    const targetEntry = this.resolveEntryForSegments(source, segments)
    if (!targetEntry) {
      return []
    }

    if (Array.isArray(targetEntry.node)) {
      return targetEntry.node.map((node, index) => ({
        node,
        parent: targetEntry.node,
        key: index,
        path: [
          ...targetEntry.path,
          index
        ]
      }))
    }

    return [targetEntry]
  }

  /**
   * Resolves a single node entry by JSON path from the root document.
   *
   * @param {string} path JSON path.
   * @returns {{node: unknown, parent: unknown, key: string|number|null, path: Array<string|number>}|null}
   * Matching node entry or `null`.
   */
  resolveNodeEntryByPath(path) {
    if (typeof path !== 'string' || !isContainer(this.document)) {
      return null
    }

    const segments = toPathSegments(path)
    if (segments.length === 0) {
      return null
    }

    return this.resolveEntryForSegments(this.document, segments)
  }

  /**
   * Resolves the matched node entry for a correction/config pair.
   *
   * @param {Object} correction Correction descriptor being applied.
   * @param {Object} config Scheme-specific node find configuration.
   * @returns {{node: unknown, parent: unknown, key: string|number|null, path: Array<string|number>}|null}
   * Matching node entry or `null`.
   */
  resolveNodeEntryByFind(correction, config) {
    let nodePath = null

    if (typeof config.nodePath === 'string') {
      nodePath = config.nodePath
    } else if (typeof correction?.ummPath === 'string') {
      nodePath = correction.ummPath
    }

    if (!nodePath) {
      return null
    }

    const entries = this.selectNodeEntries(nodePath)
    if (entries.length === 0) {
      return null
    }

    if (config.find) {
      const valueKeys = Array.isArray(config.find.valueKeys) && config.find.valueKeys.length > 0
        ? config.find.valueKeys
        : config.find.fieldPaths
      const findValueObject = normalizeValueObject(
        typeof config.find.getExpectedValueObject === 'function'
          ? config.find.getExpectedValueObject({
            correction,
            editor: this,
            valueKeys,
            fieldPaths: config.find.fieldPaths,
            findConfig: config.find
          })
          : valueKeys.reduce((keywordObject, valueKey) => ({
            ...keywordObject,
            [valueKey]: correction?.oldKeywordObject?.[valueKey]
          }), {}),
        valueKeys
      )

      if (hasAnyObjectValue(findValueObject)) {
        const matchedEntry = entries.find((entry) => {
          const nodeValueObject = normalizeValueObject(
            typeof config.find.getNodeValueObject === 'function'
              ? config.find.getNodeValueObject({
                node: entry.node,
                editor: this,
                valueKeys,
                fieldPaths: config.find.fieldPaths,
                findConfig: config.find
              })
              : this.getNodeValueObject(
                entry.node,
                config.find.fieldPaths,
                valueKeys
              ),
            valueKeys
          )

          if (!hasAnyObjectValue(nodeValueObject)) {
            return false
          }

          return valueKeys.every((valueKey) => (
            nodeValueObject[valueKey] === findValueObject[valueKey]
          ))
        })

        if (matchedEntry) {
          return matchedEntry
        }

        return null
      }
    }

    if (entries.length === 1 && isContainer(entries[0].node)) {
      return entries[0]
    }

    if (!config.find) {
      const findText = getScalarKeywordText(correction?.oldKeywordObject)
      if (findText.length > 0) {
        const matchedEntry = entries.find((entry) => this.getElementText(entry.node) === findText)

        if (matchedEntry) {
          return matchedEntry
        }

        return null
      }
    }

    return null
  }

  /**
   * Resolves a node entry for an absolute or relative path.
   *
   * @param {unknown} source Starting node for traversal.
   * @param {Array<string|number>} segments Normalized path segments.
   * @returns {{node: unknown, parent: unknown, key: string|number|null, path: Array<string|number>}|null}
   * Matching node entry or `null`.
   */
  resolveEntryForSegments(source, segments) {
    let currentNode = source
    let parent = null
    let key = null

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]

      if (!isContainer(currentNode)) {
        return null
      }

      if (Array.isArray(currentNode)) {
        if (!Number.isInteger(segment) || segment < 0 || segment >= currentNode.length) {
          return null
        }
      } else if (!(segment in currentNode)) {
        return null
      }

      parent = currentNode
      key = segment
      currentNode = currentNode[segment]
    }

    return {
      node: currentNode,
      parent,
      key,
      path: segments.slice()
    }
  }

  /**
   * Ensures a JSON path exists beneath the provided source node and returns the terminal entry.
   *
   * @param {unknown} source Starting container.
   * @param {Array<string|number>} segments Normalized path segments.
   * @returns {{node: unknown, parent: unknown, key: string|number|null, path: Array<string|number>}|null}
   * Created or existing terminal entry.
   */
  ensureEntryForSegments(source, segments) {
    let currentNode = source

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]
      const nextSegment = segments[index + 1]
      const isLastSegment = index === segments.length - 1

      if (!isContainer(currentNode)) {
        return null
      }

      if (Array.isArray(currentNode)) {
        if (!Number.isInteger(segment) || segment < 0) {
          return null
        }

        if (isLastSegment) {
          return {
            node: currentNode[segment],
            parent: currentNode,
            key: segment,
            path: segments.slice()
          }
        }

        if (!isContainer(currentNode[segment])) {
          currentNode[segment] = shouldCreateArrayForNextSegment(nextSegment) ? [] : {}
        }

        currentNode = currentNode[segment]
      } else {
        if (isLastSegment) {
          return {
            node: currentNode[segment],
            parent: currentNode,
            key: segment,
            path: segments.slice()
          }
        }

        if (!isContainer(currentNode[segment])) {
          currentNode[segment] = shouldCreateArrayForNextSegment(nextSegment) ? [] : {}
        }

        currentNode = currentNode[segment]
      }
    }

    return null
  }

  /**
   * Replaces a node entry's current value.
   *
   * @param {{parent: unknown, key: string|number|null}} entry Target node entry.
   * @param {unknown} value Replacement value.
   */
  setEntryValue(entry, value) {
    const parent = entry?.parent

    if (!entry || entry.key === null || !isContainer(parent)) {
      return
    }

    parent[entry.key] = value
  }

  /**
   * Removes a node entry from its parent object/array.
   *
   * @param {{parent: unknown, key: string|number|null}} entry Target node entry.
   */
  removeEntry(entry) {
    const parent = entry?.parent

    if (!entry || entry.key === null || !isContainer(parent)) {
      return
    }

    if (Array.isArray(parent)) {
      if (Number.isInteger(entry.key) && entry.key >= 0 && entry.key < parent.length) {
        parent.splice(entry.key, 1)
      }

      return
    }

    delete parent[entry.key]
  }
}

export {
  hasAnyObjectValue,
  sequentialValueReplace
}

export default JsonMetadataPathEditor
