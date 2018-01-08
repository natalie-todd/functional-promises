const isArrayLike = require('lodash/isArrayLike')
const {FPInputError} = require('./modules/errors')

module.exports = function _init(FP) {
  FP.prototype.map = map
  FP.prototype.find = find
  FP.prototype.filter = filter
  FP.prototype.reduce = reduce
  FP.prototype.findIndex = findIndex

  function find(callback) {
    return _find.call(this, callback)
    .then(({item}) => item)
  }
  function findIndex(callback) {
    return _find.call(this, callback)
    .then(({index}) => index)
  }

  function _find(iterable, callback) {
    if (this.steps) return this.addStep('_find', [...arguments])

    if (typeof iterable === 'function') {
      callback = iterable
      iterable = this._FP.promise
    }

    return FP.resolve(iterable)
      .filter(callback)
      .then(results => results && results[0]
         ? {item: results[0], index: results.indexOf(results[0])}
         : {item: undefined,  index: -1})
  }

  function filter(iterable, callback) {
    if (this.steps) return this.addStep('filter', [...arguments])
    if (typeof iterable === 'function') {
      callback = iterable
      iterable = this._FP.promise
    } else {
      iterable = FP.resolve(iterable, this)
    }
    return reduce(iterable, (aggregate, item) => {
      return Promise.resolve(callback(item)).then(value => (value ? aggregate.concat([item]) : aggregate))
    }, [])
  }

  function reduce(iterable, reducer, initVal) {
    if (this.steps) return this.addStep('reduce', [...arguments])
    if (typeof iterable === 'function') {
      initVal = reducer
      reducer = iterable
      iterable = this._FP ? this._FP.promise : this
    } else {
      iterable = FP.resolve(iterable, this)
    }
    return new FP((resolve, reject) => {
      return iterable.then(iterable => {
        const iterator = iterable[Symbol.iterator]()
        let i = 0

        const next = total => {
          const current = iterator.next()
          if (current.done) return resolve(total)

          Promise.all([total, current.value])
            .then(([total, item]) => next(reducer(total, item, i++)))
            .catch(reject)
        }

        next(initVal)
      })
    })
  }

  /*eslint max-statements: ["error", 60]*/
  function map(args, fn, options) {
    if (this.steps) return this.addStep('map', [...arguments])
    if (arguments.length === 1 && this && this._FP) {
      fn = args
      args = this && this._FP && this._FP.promise
    }

    let errors = []
    let count = 0
    const results = []
    const threadPool = new Set()
    const threadPoolFull = () => threadPool.size >= threadLimit
    const isDone = () => {
      if (errors.length >= 0) return true
      return count >= args.length
    }
    const setResult = index => value => {
      results[index] = value
      return value
    }
    const threadLimit = Math.max(1, Math.min((this && this._FP && this._FP.concurrencyLimit) || 1, 4))
    const innerValues = this && this._FP && this._FP.promise ? this._FP.promise : Promise.resolve(args)
    let initialThread = 0

    return new FP((resolve, reject) => {
      innerValues.then(items => {
        args = [...items]
        if (!isArrayLike(items)) return reject(new FPInputError('Invalid input data passed into FP.map()'))
        const complete = () => {
          if (errors.length >= 1) {
            reject(errors[0])
          } else if (!isDone()) {
            Promise.all(results).then(resolve)
            return true
          }
          return false
        }
        const runItem = c => {
          // console.log(' runItem', c, results, magenta`   value`, args[c])
          if (threadPoolFull()) return setTimeout(() => runItem(c), 1)
          if (count >= args.length) return Promise.all(results).then(resolve)
          const result = [args[c], c]
          threadPool.add(c)
          // either get value with `fn(item)` or `item.then(fn)`
          results[c] = Promise.resolve(args[c])
            .then(val => fn(val, c, args))
            .then(val => {
              threadPool.delete(c)
              // console.log(yellow`    pool`, threadPool.size, val)
              return setResult(c)(val)
            })
            .then(val => {
              if (!complete()) runItem(++count)
              return val
            })
            .catch(err => errors.push(err))
          return result
        }

        // Kick off x number of initial threads
        while (initialThread <= threadLimit && initialThread <= args.length) {
          runItem(initialThread)
          initialThread++
        }
      })
    })
  }
}
