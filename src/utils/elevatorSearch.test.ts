import { describe, expect, it } from 'vitest';
import { buildElevatorSearchFilters } from './elevatorSearch';

describe('elevator search input', () => {
  it('preserva acentos y puntuación del edificio dentro de un único valor', () => {
    const input = '  San Martín (Torre B), "Centro"  ';
    const { building } = buildElevatorSearchFilters(input);
    const values = [...building.matchAll(/(?:^|,)(\w+)\.ilike\.("(?:\\.|[^"])*")/g)];
    expect(values.map((match) => match[1])).toEqual(['name', 'address', 'locality']);
    for (const match of values) expect(JSON.parse(match[2])).toBe(`%${input.trim()}%`);
  });

  it('no permite que el texto agregue operadores al filtro', () => {
    const input = 'Centro"),active.eq.false,code.ilike.("';
    const { equipment } = buildElevatorSearchFilters(input);
    const values = [...equipment.matchAll(/(?:^|,)(\w+)\.ilike\.("(?:\\.|[^"])*")/g)];
    expect(values.map((match) => match[1])).toEqual(['code', 'serial_number', 'manufacturer']);
    for (const match of values) expect(JSON.parse(match[2])).toBe(`%${input}%`);
    expect(equipment.replace(/"(?:\\.|[^"])*"/g, 'VALUE')).not.toContain('active.eq.false');
  });

  it('escapa porcentaje, guion bajo y barra inversa como texto de búsqueda', () => {
    const { building } = buildElevatorSearchFilters('Torre 100%_A\\B');
    const value = building.match(/^name\.ilike\.("(?:\\.|[^"])*")/)![1];
    expect(JSON.parse(value)).toBe('%Torre 100\\%\\_A\\\\B%');
  });
});
