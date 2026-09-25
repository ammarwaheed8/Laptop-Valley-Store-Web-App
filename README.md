# Laptop Valley

Laptop Valley is a PHP + SQLite laptop e-commerce web app.

## Included

- Customer storefront
- Cart and checkout
- PHP API backend
- SQLite database
- Admin login and inventory management
- Order management
- Stock management

## Deployment

This build is prepared for HelioHost shared hosting.

See `HELIOHOST-SETUP.md` for the exact upload and testing procedure.


## Laptop image uploads

The admin panel supports up to 3 optional laptop images using local file uploads. Images are stored under `assets/laptops/` and their relative paths are stored in the database `images` field. The first image is used as the storefront thumbnail. The Details modal cycles through all stored images with left/right arrows. Existing records can be edited without any URL field; legacy remote images remain displayable until replaced. Deleting a laptop removes its locally stored image files.

## Product Categories: Laptops + Accessories

The storefront and admin panel now use a shared product-category system. Existing products are kept as `Laptop` records; new products can be saved under `Laptop` or `Accessories`.

Accessory subcategories include Mouse, Keyboard, Headset, Laptop Bag, Charger / Adapter, Cooling Pad, Dock / Hub, Storage, RAM / Memory, Monitor, Cable, and Other.

Accessories use the same inventory, pricing, cart, checkout, order, and three-image upload system as laptops. Laptop-specific specification fields are shown only when the category is `Laptop`.

On the storefront, shoppers can filter by category and brand. The RAM filter applies only to laptops. Product details show a generic product information table for accessories and the full technical specification table for laptops.

## Product categories

The current build supports three product categories:
- Laptop
- Desktop PC
- Accessories

Desktop PC products have dedicated fields for processor, RAM, storage, graphics card, motherboard, power supply, case/form factor, cooling, and operating system. Existing laptop and accessory records remain compatible.


Public navigation is implemented entirely inside `index.html` as a single-page layout: `#home`, `#store`, and `#contact`. The same navbar and cart remain available while switching between public views. Separate public `store.html` and `contact.html` files are not included.
