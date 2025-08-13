# Changelog for @headwall/trusted-network-providers

## 1.8.1 :: 2025-08-13

* Updated the ShipHero provider.
* Updated assets with scripts/update-assets.sh

## 1.8.0 :: 2025-07-13

* Added Labrika provider
* Updated assets with scripts/update-assets.sh

## 1.7.0 :: 2025-06-02

* Added GetTerms provider
* Updated assets with scripts/update-assets.sh

## 1.6.0 :: 2024-12-15

* Added Brevo provider
* Updated assets with scripts/update-assets.sh

## 1.5.1 :: 2024-12-06

* Tidy up

## 1.5.0 :: 2024-12-06

* Added SemrushBot provider
* Added AHrefsBot provider
* Added FacebookBot provider

## 1.4.5 :: 2024-10-15

* Version bump to push the new readme to npm

## 1.4.4 :: 2024-10-14

* Tidied up assets.
* Moved the repos to Github. 
* Updated deps.

## 1.4.3 :: 2024-08-03

* Removed GTmetrix from the list of trusted servers because of a Cloudflare issue.

## 1.4.2 :: 2023-11-12

* Version bump, update changelog and republish to npm.

## 1.4.1 :: 2023-11-12

* Updated bundled IP address list assets.

## 1.4.0 :: 2023-07-28

* Added new function deleteProvider(providerName)
* In index.js, moved the providers array into self

## 1.3.7 :: 2023-07-10

* Minor : Updated bundled assets and version-bumped the package.

## 1.3.6 :: 2023-05-26

* New provider : BunnyNet IPs. Currently supplied as static files that can be updated by the update-assets.sh script, but we might rejig this as an auto-updater.

## 1.3.5 :: 2023-05-22

* Added a small bash script to fetch/udpate src/assets/googlebot-ips.json

## 1.3.4 :: 2023-05-19

* Ship a built-in set of GoogleBot IPs so we don't need to keep hitting Google for the JSON download at regular intervals.

## 1.3.2 & 1.3.3 :: 2023-05-15

* New provider : Seobility web crawlers
* Fixed a bug where some providers "self" wasn't set to const.

## 1.3.1 :: 2023-04-26

* New provider : GTmetrix test locations

## 1.3.0 :: 2023-04-25

* New provider : Mailgun
* Added a new helper, "spf-analyser" to make it easier to create trusted providers that store their IP addresses in (potentially dynamic) DNS/TXT (SPF) records, such as Google and Mailgun. NOTE: We need to move Outlook over to this new methodology too.
* Fixed some promise-based logic issues when moving the Google Workspace code over to the spf-analyser code.

## 1.2.0 :: 2023-04-21

* New provider : ShipHero

## 1.1.1 :: 2023-04-11

* Improved "README.md" with more info on how to create your own trusted network provider, complete with dynamic update.

## 1.1.0 :: 2023-04-11

* Added a new provider called "Google Services", with their DNS resolvers.
* Tidied up the tests a little bit.
