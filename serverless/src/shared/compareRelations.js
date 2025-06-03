/**
 * Compares two sets of relations to determine which relations were added and which were removed.
 *
 * @function compareRelations
 * @param {Array<Object>} beforeRelations - Array of relation objects before the update
 * @param {Array<Object>} afterRelations - Array of relation objects after the update
 * @returns {Object} An object containing arrays of added and removed relations
 * @property {Array<Object>} addedRelations - Array of relation objects that were added
 * @property {Array<Object>} removedRelations - Array of relation objects that were removed
 *
 * @example
 * const beforeRelations = [
 *   { from: 'concept1', relation: 'broader', to: 'concept2' },
 *   { from: 'concept1', relation: 'related', to: 'concept3' }
 * ];
 * const afterRelations = [
 *   { from: 'concept1', relation: 'broader', to: 'concept2' },
 *   { from: 'concept1', relation: 'narrower', to: 'concept4' }
 * ];
 * const result = compareRelations(beforeRelations, afterRelations);
 * // result = {
 * //   addedRelations: [{ from: 'concept1', relation: 'narrower', to: 'concept4' }],
 * //   removedRelations: [{ from: 'concept1', relation: 'related', to: 'concept3' }]
 * // }
 *
 * @description
 * This function compares two sets of relations (before and after an update) to determine
 * which relations were added and which were removed. It does this by:
 * 1. Iterating through the 'after' relations and checking if each exists in the 'before' set.
 *    If not, it's considered an added relation.
 * 2. Iterating through the 'before' relations and checking if each still exists in the 'after' set.
 *    If not, it's considered a removed relation.
 * The function assumes that each relation object has 'from', 'relation', and 'to' properties.
 */
export const compareRelations = (beforeRelations, afterRelations) => {
  const addedRelations = []
  const removedRelations = []

  // Check for added relations
  afterRelations.forEach((afterRelation) => {
    const exists = beforeRelations.some(
      (beforeRelation) => beforeRelation.from === afterRelation.from
      && beforeRelation.relation === afterRelation.relation
      && beforeRelation.to === afterRelation.to
    )
    if (!exists) {
      addedRelations.push(afterRelation)
    }
  })

  // Check for removed relations
  beforeRelations.forEach((beforeRelation) => {
    const stillExists = afterRelations.some(
      (afterRelation) => afterRelation.from === beforeRelation.from
      && afterRelation.relation === beforeRelation.relation
      && afterRelation.to === beforeRelation.to
    )
    if (!stillExists) {
      removedRelations.push(beforeRelation)
    }
  })

  return {
    addedRelations,
    removedRelations
  }
}
