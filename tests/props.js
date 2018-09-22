const test = require('ava')
const FP = require('../').default

console.log(FP)
console.log('FP.all', FP.all)
console.log('FP.resolve', FP.resolve)

test('FP.get(...keyNames)', t => FP
  .resolve({foo: 'bar', baz: 'woo'})
  .get('foo', 'baz')
  .then(obj => t.is(obj.foo, 'bar'))
)

test('FP.get([keyNames])', t => FP
  .resolve({foo: 'bar', baz: 'woo'})
  .get(['foo', 'baz'])
  .then(obj => t.is(obj.foo, 'bar'))
)

test('FP.get(keyName)', t => FP
  .resolve({foo: 'bar'})
  .get('foo')
  .then(bar => t.is(bar, 'bar'))
)

test('FP.set(keyName, value)', t => FP
  .resolve({foo: 'bar'})
  .set('foo', 'baz')
  .then(obj => t.is(obj.foo, 'baz'))
)



