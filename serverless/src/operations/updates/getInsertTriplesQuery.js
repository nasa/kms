export const getInsertTriplesQuery = (triples) => `
  INSERT DATA {
    ${triples.map((triple) => `<${triple.s.value}> <${triple.p.value}> ${
    triple.o.type === 'uri' ? `<${triple.o.value}>` : `"${triple.o.value}"`
  } .`).join('\n')}
  }
`
