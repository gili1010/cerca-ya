import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
const exports = {};
const { outputText } = ts.transpileModule(readFileSync(new URL("../src/lib/business-hours.ts",import.meta.url),"utf8"), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
});
runInNewContext(outputText,{exports,Intl,Date});
const { getBusinessHoursState: state, validateBusinessHours: validate } = exports;
const p = (weekday,opens_at,closes_at,period_index=0)=>({weekday,opens_at,closes_at,period_index});
const schedule=(...periods)=>({configured:true,periods});
const now=(day,time)=>new Date(`2026-10-${day}T${time}:00-03:00`);
const monday=p(1,"09:00","18:00");
test("A normal daytime at 10:00 is OPEN; opening boundary is inclusive",()=>{
  assert.equal(state(schedule(monday),now("12","10:00")).state,"OPEN");
  assert.equal(state(schedule(monday),now("12","09:00")).state,"OPEN");
});
test("B 18:00 closing boundary is CLOSED",()=>assert.equal(state(schedule(monday),now("12","18:00")).state,"CLOSED"));
test("C before opening reports today 09:00",()=>assert.equal(state(schedule(monday),now("12","08:00")).label,"Cerrado · abre hoy a las 09:00"));
test("D nighttime period at 23:30 closes at 02:00",()=>{
  const result=state(schedule(p(5,"19:00","02:00")),now("09","23:30"));
  assert.equal(result.state,"OPEN"); assert.equal(result.closesAt,"02:00");
});
test("E Saturday 01:00 inherits Friday nighttime; today's calendar remains Saturday",()=>{
  const result=state(schedule(p(5,"19:00","02:00")),now("10","01:00"));
  assert.equal(result.state,"OPEN"); assert.equal(result.closesAt,"02:00"); assert.equal(result.today.length,0);
  assert.equal(state(schedule(p(5,"19:00","02:00")),now("10","02:00")).state,"CLOSED");
});
test("F closed day finds next weekday and tomorrow correctly",()=>{
  assert.equal(state(schedule(monday),now("10","10:00")).label,"Cerrado · abre el lunes a las 09:00");
  assert.equal(state(schedule(monday),now("11","10:00")).label,"Cerrado · abre mañana a las 09:00");
});
test("G split schedule gap opens today at 17:00",()=>assert.equal(state(schedule(p(1,"09:00","13:00"),p(1,"17:00","21:00",1)),now("12","14:00")).label,"Cerrado · abre hoy a las 17:00"));
test("H unconfigured is NO_SCHEDULE, not CLOSED",()=>assert.equal(state({configured:false,periods:[]},now("12","10:00")).label,"Horario no informado"));
test("I configured empty week CLOSED with no next opening",()=>{
  const result=state(schedule(),now("12","10:00")); assert.equal(result.state,"CLOSED"); assert.equal(result.nextOpening,null);
});
test("J Sunday to Monday preserves overnight and next opening",()=>{
  assert.equal(state(schedule(p(0,"19:00","02:00")),now("12","01:00")).state,"OPEN");
  assert.equal(state(schedule(monday),now("11","23:59")).label,"Cerrado · abre mañana a las 09:00");
});
test("validation rejects duplicates, overlapping days, week wrap and malformed inputs",()=>{
  assert.ok(validate([p(1,"09:00","15:00"),p(1,"14:00","18:00",1)]));
  assert.ok(validate([p(5,"19:00","02:00"),p(6,"01:00","03:00")]));
  assert.ok(validate([p(6,"19:00","02:00"),p(0,"01:00","03:00")]));
  assert.ok(validate([p(1,"09:00","13:00"),p(1,"09:00","13:00",1)]));
  assert.ok(validate([p(1,"24:00","13:00")]));
  assert.ok(validate([p(1,"09:00","09:00")]));
  assert.ok(validate([p(7,"09:00","13:00")]));
  assert.ok(validate([p(1,"09:00","13:00",2)]));
  assert.equal(validate([p(5,"19:00","02:00"),p(6,"02:00","03:00")]),null);
});
test("adjacent intervals use real continuous closing and explicit Cordoba timezone",()=>{
  assert.equal(state(schedule(p(1,"09:00","13:00"),p(1,"13:00","18:00",1)),now("12","10:00")).closesAt,"18:00");
  assert.equal(state(schedule(monday),new Date("2026-10-12T11:00:00Z")).state,"CLOSED");
  assert.equal(state(schedule(monday),new Date("2026-10-12T12:00:00Z")).state,"OPEN");
  const fullWeek=Array.from({length:7},(_,day)=>[p(day,"00:00","12:00"),p(day,"12:00","00:00",1)]).flat();
  assert.equal(validate(fullWeek),null);
  assert.equal(state(schedule(...fullWeek),now("12","10:00")).closesAt,null);
});
