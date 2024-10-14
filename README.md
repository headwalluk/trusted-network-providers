# trusted-network-providers

Provides a quick way of taking an IP address and seeing if it matches against a trusted network provider.

## Sample usage

The main function is `getTrustedProvider(ipAddress)` and it returns the name of the trusted provider (if found) or null.

```javascript
const trustedProviders = require('@headwall/trusted-network-providers');

trustedProviders.loadDefaultProviders();

trustedProviders.reloadAll()
	.then(() => {
		console.log('Ready to run');
		console.log(trustedProviders.getTrustedProvider('123.123.123.123'));
		console.log(trustedProviders.getTrustedProvider('8.8.8.8'));
	});
```

## Custom trusted network providers

Trusted network providers are simple collections of IP addresses and ranges. You can add your own provider like this:

```javascript
/**
 * Add a custom trusted network provider that contains two addresses,
 * and add these addresses to the tests.
 */
trustedProviders.addProvider({
	name: 'My custom network',
	testAddresses: [
		'12.12.12.34',
		'12.12.34.34'
	],
	ipv4: {
		addresses: [
			'12.12.12.34',
			'12.12.34.34'
		],
		ranges: []
	},
	ipv6: {
		addresses: [],
		ranges: []
	}
});
```

Addresses ranges can be specified in CIDR format:

```json
ipv4: {
	addresses: [],
	ranges: [
		'12.12.12.0/24'
	]
}
```

### Dynamic reload

If your trusted network provider needs to update its list of addressess occasionally, provide a `reload()` function that returns a promise:

```javascript
/**
 * Add a custom trusted network provider that contains two addresses,
 * and add these addresses to the tests.
 */
const myProvider = {
	name: 'My custom network',
	reload: () => {
		return new Promise((resolve, reject) => {
			// Do some logic to fetch the addresses...
			myProvider.ipv4.addresses = [];
			myProvider.ipv4.addresses.push(yourCustomAddress1);
			myProvider.ipv4.addresses.push(yourCustomAddress2);
			myProvider.ipv4.ranges.push(yourCustomCidrRange1);
			// ...
				// Finished.
			resolve();
		});
	},
	testAddresses: [],
	ipv4: {
		addresses: [],
		ranges: []
	},
	ipv6: {
		addresses: [],
		ranges: []
	}
};
```

## Additional functionality

Additional utility functions:

```javascript
addProvider(provider)
getAllProviders()
getTrustedProvider(ipAddress)
hasProvider(providerName)
hasProvider(provider)
isTrusted(ipAddress)
loadDefaultProviders()
reloadAll()
runTests()
```
