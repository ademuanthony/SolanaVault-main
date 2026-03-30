const crypto = require('crypto');

function getDiscriminator(name) {
    const hash = crypto.createHash('sha256').update(`account:${name}`).digest();
    return hash.slice(0, 8);
}

console.log('GlobalConfig:', getDiscriminator('GlobalConfig').toString('hex'));
console.log('VaultState:', getDiscriminator('VaultState').toString('hex'));
