# Restaurant Management System

A simple desktop application built with Electron.js for managing restaurant operations including stock, dishes, sales, and available items.

## Features

- **Stock Management**: Track inventory items with quantities, units, and prices
- **Dishes Management**: Create and manage menu items with descriptions and ingredients
- **Sales Management**: Record sales transactions and view sales history with summaries
- **Items Available**: Manage available items with categories and stock status

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

To start the application:
```bash
npm start
```

To start with developer tools (for debugging):
```bash
npm run dev
```

## Usage

### Stock Management
- Add stock items with name, quantity, unit, and price per unit
- View total value of each stock item
- Edit or delete existing stock items

### Dishes Management
- Create dishes with name, price, description, and ingredients
- Edit or delete dishes
- Dishes can be selected when recording sales

### Sales Management
- Record sales by selecting a dish, quantity, and price
- View sales history sorted by date
- See summary statistics: Total Sales, Total Orders, Today's Sales

### Items Available
- Add items with name, quantity, price, and category
- Filter items by category (Food, Beverage, Dessert, Other)
- View availability status (Available/Out of Stock)

## Data Storage

All data is stored locally in the browser's localStorage, so your data persists between sessions.

## Technologies Used

- Electron.js - Desktop application framework
- HTML/CSS/JavaScript - Frontend technologies
- localStorage - Data persistence

## Project Structure

```
restaurant-management-system/
├── main.js          # Electron main process
├── index.html       # Main UI structure
├── renderer.js      # Frontend logic
├── styles.css       # Styling
├── package.json     # Dependencies and scripts
├── assets/          # Assets folder
│   └── logo.jpg     # Restaurant logo (required)
└── README.md        # This file
```

## Logo Setup

The application displays a logo in the sidebar. Place your logo file (`logo.jpg`) in the `assets/` folder. The logo should be:
- Format: JPG
- Recommended size: 200x200 pixels or larger (square format works best)
- The logo will be displayed in a circular frame

If the logo file is not found, a fallback icon will be displayed instead.

## Notes

- The application uses localStorage for data persistence
- All data is stored locally on your machine
- The application works offline once installed

