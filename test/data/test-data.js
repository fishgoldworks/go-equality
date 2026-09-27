function Entity(name) {
    this.name = name;
}

Entity.prototype.equals = function (other) {
    return other instanceof Entity && this.name === other.name;
};

function Item(name) {
    this.name = name;
}

var data = {
    symbol1: Symbol("abc"),
    symbol2: Symbol("abc"),
    entity1: new Entity(1),
    entity2: new Entity(1),
    entity3: new Entity("1"),
    item1: new Item(1),
    fn1: function diff(a, b) {
        return Math.abs(b - a);
    },
    fn2: function diff2(a, b) {
        return Math.abs(b - a);
    },
    fn3: function diff(a, b) {
        return Math.abs(a - b);
    },
    cyclic1: {id: 1, ref: null},
    cyclic2: {id: 1, ref: null},
    cyclic3: {id: "1", ref: null},
    cyclic4: {id: 1, name: "foo", enabled: true, linked: []},
    cyclic5: {linked: [], enabled: true, id: 1, name: "foo"},
    cyclic6: {id: 1, name: "foo", enabled: true, linked: []}
};

data.entity3.equals = function () {
    return true;
};

data.cyclic1.ref = data.cyclic1;
data.cyclic2.ref = data.cyclic2;
data.cyclic3.ref = data.cyclic3;

data.cyclic4.linked[0] = data.cyclic1;
data.cyclic4.linked[1] = data.cyclic2;

data.cyclic5.linked[0] = data.cyclic2;
data.cyclic5.linked[1] = data.cyclic1;

data.cyclic6.linked[0] = data.cyclic1;
data.cyclic6.linked[1] = data.cyclic3;

module.exports = data; 