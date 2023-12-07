(function (myArr, num) {
  var reductionArr = function (nums) {
    while (--nums) {
      myArr.push(myArr.shift());
    }
  };
  reductionArr(++num);
}(arr, 0x10));