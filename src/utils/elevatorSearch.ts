/**
 * Keep user text inside a quoted PostgREST value. In particular, commas,
 * parentheses and quotes in a building name must not become filter operators.
 */
export function buildElevatorSearchFilters(query: string, includeModel = false) {
  const literal = query.trim().replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
  const pattern = `"%${literal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`;
  const equipmentColumns = ['code', 'serial_number', 'manufacturer'];
  if (includeModel) equipmentColumns.push('model');

  return {
    equipment: [
      ...equipmentColumns.map((column) => `${column}.ilike.${pattern}`),
      'building_search.not.is.null',
    ].join(','),
    building: ['name', 'address', 'locality'].map((column) => `${column}.ilike.${pattern}`).join(','),
  };
}
