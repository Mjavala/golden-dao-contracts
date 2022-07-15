// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC20.sol";
import "./Ownable.sol";

contract Valar is ERC20, Ownable {
    constructor() ERC20("Valar", "Valar") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);

    }

    function transfer(address to, address from, uint256 amount) public virtual override onlyOwner returns (bool) {
        require(amount == 1, "Can only transfer one");
        _transfer(from, to, amount);
        return true;
    }
}