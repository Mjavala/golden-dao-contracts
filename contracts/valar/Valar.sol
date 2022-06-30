// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC20.sol";
import "./ERC20Burnable.sol";
import "./Ownable.sol";

contract MyToken is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("MyToken", "MTK") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);

    }

    function transfer(address to, address from, uint256 amount) public virtual override onlyOwner returns (bool) {
        _transfer(from, to, amount);
        return true;
    }
}
