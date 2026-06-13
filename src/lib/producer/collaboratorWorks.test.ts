import { describe, expect, it } from 'vitest';
import {
  formatCollaboratorWorksInput,
  normalizeCollaboratorWorks,
  parseCollaboratorWorksInput,
} from './collaboratorWorks';

describe('collaborator works input helpers', () => {
  it('parses artist lines into collaborator work groups', () => {
    expect(parseCollaboratorWorksInput('孙燕姿：遇见、需要你、第一天\n林俊杰: 她说, 水仙')).toEqual([
      { name: '孙燕姿', works: ['遇见', '需要你', '第一天'] },
      { name: '林俊杰', works: ['她说', '水仙'] },
    ]);
  });

  it('drops empty names and empty works', () => {
    expect(parseCollaboratorWorksInput('：空行\n张学友： 白月光、、吻别\n无作品：')).toEqual([
      { name: '张学友', works: ['白月光', '吻别'] },
    ]);
  });

  it('formats collaborator work groups back to textarea lines', () => {
    expect(formatCollaboratorWorksInput([
      { name: '孙燕姿', works: ['遇见', '需要你'] },
      { name: '林俊杰', works: ['她说'] },
    ])).toBe('孙燕姿：遇见、需要你\n林俊杰：她说');
  });

  it('normalizes JSON values from the database', () => {
    expect(normalizeCollaboratorWorks([
      { name: ' 孙燕姿 ', works: [' 遇见 ', '', 42] },
      { name: '', works: ['无效'] },
      { name: '林俊杰', works: '她说' },
    ])).toEqual([
      { name: '孙燕姿', works: ['遇见'] },
    ]);
  });
}
);
