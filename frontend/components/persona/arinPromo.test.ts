import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const css=readFileSync(resolve(__dirname,'arinStudio.css'),'utf8');
describe('Arin replacement close control',()=>{it('close participates in right-aligned header and has 44px target',()=>{expect(css).toContain('justify-content:space-between');expect(css).toContain('.arin-close{width:44px;height:44px');expect(css).not.toContain('.ap-sheet>*');});});
