# Ant Design, i18n, & Theme Refactoring Plan

The application currently has a hardcoded HTML/CSS UI and static sidebar tabs. This plan details the migration to a fully functional Ant Design architecture with multi-language support (i18n) and a Light/Dark mode toggle.

## User Review Required

> [!IMPORTANT]
> - **Translations**: I will configure English (EN) and Vietnamese (VI) as the two supported languages. If you want additional languages, please let me know.
> - **Tab Navigation**: I will refactor the sidebar to actually switch the main content view between *Storefront*, *Inventory*, *Customers*, and *Settings*. Currently, only *Storefront* has data; the others will show placeholder text until we build them.

## Proposed Changes

### 1. Install Dependencies
Run `npm install i18next react-i18next` in the `client` directory to support multi-language features.

### 2. Configure i18n
#### [NEW] [client/src/i18n.js](file:///d:/kh%C3%B3a-lu%E1%BA%ADn-t%E1%BB%91t-nghi%E1%BB%87p/qu-n-ly-ban-l/source/client/src/i18n.js)
- Create a configuration file containing translation dictionaries for English and Vietnamese.

### 3. App Provider Configuration
#### [MODIFY] [client/src/App.jsx](file:///d:/kh%C3%B3a-lu%E1%BA%ADn-t%E1%BB%91t-nghi%E1%BB%87p/qu-n-ly-ban-l/source/client/src/App.jsx)
- Wrap the application in Ant Design's `ConfigProvider`.
- Manage the global state for `theme` (light/dark) and pass it to the provider to dynamically switch colors.

### 4. Dashboard Refactoring
#### [MODIFY] [client/src/pages/Dashboard.jsx](file:///d:/kh%C3%B3a-lu%E1%BA%ADn-t%E1%BB%91t-nghi%E1%BB%87p/qu-n-ly-ban-l/source/client/src/pages/Dashboard.jsx)
- Rebuild the layout using Ant Design's `<Layout>`, `<Sider>`, and `<Header>` components.
- Use Ant Design's `<Menu>` to handle sidebar clicks and switch a React state (`activeTab`) to render different views.
- Add a Theme Toggle switch and Language selector dropdown in the header.
- Rebuild the Storefront product grid using Ant Design `<Card>`, `<Row>`, and `<Col>` components.

## Verification Plan
1. Start the client and server.
2. Verify that clicking sidebar items switches the view.
3. Click the Dark/Light mode toggle and ensure Ant Design components adapt correctly.
4. Switch between EN/VI languages and verify that sidebar text and product labels translate dynamically.
