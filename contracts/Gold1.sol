// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Gold1 is ERC20 {
    constructor() ERC20("Gold 1", "GOLD1") {
        _mint(msg.sender, 100000 * 10 ** decimals());
    }
}