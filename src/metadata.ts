import { parseDocument, isMap, isScalar } from 'yaml';
export function validate(text:string):{name?:string;description?:string;warnings:string[]} {
  const warnings:string[]=[];
  const block=text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if(!block)return {warnings:['Missing or invalid YAML frontmatter.']};
  try{
    const doc=parseDocument(block[1],{schema:'core',uniqueKeys:true,customTags:[]});
    if(doc.errors.length||doc.warnings.length||!isMap(doc.contents))return {warnings:['Invalid YAML frontmatter.']};
    const result:{name?:string;description?:string;warnings:string[]}={warnings};
    for(const key of ['name','description'] as const){
      const node=doc.get(key,true);
      if(!isScalar(node)||typeof node.value!=='string'||!node.value.trim())warnings.push(`Missing or invalid frontmatter ${key}.`);
      else result[key]=node.value;
    }
    return result;
  }catch{return {warnings:['Invalid YAML frontmatter.']};}
}
