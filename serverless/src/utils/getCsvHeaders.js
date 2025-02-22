const getCsvHeaders = (scheme) => {
  let headers = []
  switch (scheme) {
    case 'chronounits':
      headers = ['Eon', 'Era', 'Period', 'Epoch', 'Age', 'Sub-Age', 'UUID']
      break
    case 'sciencekeywords':
      headers = ['Category', 'Topic', 'Term', 'Variable_Level_1', 'Variable_Level_2', 'Variable_Level_3', 'Detailed_Variable', 'UUID']
      break
    case 'locations':
      headers = ['Location_Category', 'Location_Type', 'Location_Subregion1', 'Location_Subregion2', 'Location_Subregion3', 'Location_Subregion4', 'UUID']
      break
    case 'providers':
      headers = ['Bucket_Level0', 'Bucket_Level1', 'Bucket_Level2', 'Bucket_Level3', 'Short_Name', 'Long_Name', 'Data_Center_URL', 'UUID']
      break
    case 'platforms':
      headers = ['Basis', 'Category', 'Sub_Category', 'Short_Name', 'Long_Name', 'UUID']
      break
    case 'instruments':
      headers = ['Category', 'Class', 'Type', 'Subtype', 'Short_Name', 'Long_Name', 'UUID']
      break
    case 'projects':
      headers = ['Bucket', 'Short_Name', 'Long_Name', 'UUID']
      break
    case 'discipline':
      headers = ['Discipline_Name', 'Subdiscipline', 'UUID']
      break
    case 'idnnode':
      headers = ['Short_Name', 'Long_Name', 'UUID']
      break
    case 'isotopiccategory':
      headers = ['ISO_Topic_Category', 'UUID']
      break
    case 'rucontenttype':
      headers = ['URLContentType', 'Type', 'Subtype', 'UUID']
      break
    case 'rucontenttype_heritage':
      headers = ['Type', 'Subtype', 'UUID']
      break
    case 'horizontalresolutionrange':
      headers = ['Horizontal_Resolution_Range', 'UUID']
      break
    case 'verticalresolutionrange':
      headers = ['Vertical_Resolution_Range', 'UUID']
      break
    case 'temporalresolutionrange':
      headers = ['Temporal_Resolution_Range', 'UUID']
      break
    case 'measurementname':
      headers = ['Context_Medium', 'Object', 'Quantity', 'UUID']
      break
    case 'dataformat':
      headers = ['Short_Name', 'Long_Name', 'UUID']
      break
    default:
  }

  return headers
}

export default getCsvHeaders
