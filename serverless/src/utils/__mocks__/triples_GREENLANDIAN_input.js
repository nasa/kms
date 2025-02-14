const mockInput = [
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#changeNote'
    },
    o: {
      type: 'literal',
      value: '2019-10-22 12:35:43.0 [tstevens]  \n'
        + 'insert Definition (id: null\n'
        + 'text: The Greenlandian is the earliest age or lowest stage of the Holocene epoch or series, part of the Quaternary. It is one of three subdivisions of the Holocene. The lower boundary of the Greenlandian Age is the GSSP sample from the North Greenland Ice Core Project in central Greenland (75.1000°N 42.3200°W). The Greenlandian GSSP has been correlated with the end of Younger Dryas (from near-glacial to interglacial) and a “shift in deuterium excess values.\n'
        + 'language code: en);'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#changeNote'
    },
    o: {
      type: 'literal',
      value: '2019-10-22 11:54:55.0 [tstevens] Insert Concept \n'
        + 'add broader relation (GREENLANDIAN [007cc0a7-cccf-47c9-a55d-af36592055b3,369525] - HOLOCENE [e000088a-8252-4603-ba55-38189c45612c,336111]);'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#inScheme'
    },
    o: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/chronounits'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#prefLabel'
    },
    o: {
      'xml:lang': 'en',
      type: 'literal',
      value: 'GREENLANDIAN'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#broader'
    },
    o: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/e000088a-8252-4603-ba55-38189c45612c'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    },
    o: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#Concept'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms#reference'
    },
    o: {
      type: 'bnode',
      value: '68e59f870786c032'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'http://www.w3.org/2004/02/skos/core#definition'
    },
    o: {
      'xml:lang': 'en',
      type: 'literal',
      value: 'The Greenlandian is the earliest age or lowest stage of the Holocene epoch or series, part of the Quaternary. It is one of three subdivisions of the Holocene. The lower boundary of the Greenlandian Age is the GSSP sample from the North Greenland Ice Core Project in central Greenland (75.1000°N 42.3200°W). The Greenlandian GSSP has been correlated with the end of Younger Dryas (from near-glacial to interglacial) and a “shift in deuterium excess values.'
    },
    s: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms/concept/007cc0a7-cccf-47c9-a55d-af36592055b3'
    }
  },
  {
    p: {
      type: 'uri',
      value: 'https://gcmd.earthdata.nasa.gov/kms#text'
    },
    o: {
      'xml:lang': 'en',
      type: 'literal',
      value: 'International Commission on Stratigraphy (http://www.stratigraphy.org/)'
    },
    s: {
      type: 'bnode',
      value: '68e59f870786c032'
    }
  }
]
export default mockInput
