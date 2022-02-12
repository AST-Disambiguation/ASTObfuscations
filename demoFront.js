(function (myArr, num) {
    let resetArr = function (nums) {
        while (--nums) {
            myArr.push(myArr.shift());
        }
    };
    resetArr(++num);
}(arr, 0x10));