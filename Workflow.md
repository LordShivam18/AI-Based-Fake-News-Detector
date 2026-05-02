Here’s the clean way to set up collaboration so each person works in their own branch while keeping the main repo intact:

## 🔑 Steps for Adding a Collaborator & Branch Workflow

### 1. **Add Collaborator**(FOR ME )
- Go to your GitHub repo → **Settings** → **Collaborators & teams**.
- Add their GitHub username/email.
- They’ll get an invite to join.

- 
(FOR TEAM MEMBERS)
### 2. **Clone the Repo**
Each collaborator should:
```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### 3. **Create a New Branch**
Everyone must create their own branch before making changes:
```bash
git checkout -b feature-branch-name
```
Example:  
`git checkout -b shivam-login-ui`  

This ensures changes are isolated.

### 4. **Pull Latest Code Before Work**
Always sync with the main branch before starting:
```bash
git checkout main
git pull origin main
git checkout feature-branch-name
git merge main
```

### 5. **Make Changes & Commit**
```bash
git add .
git commit -m "Added login UI"
```

### 6. **Push Branch to GitHub**
```bash
git push origin feature-branch-name
```

### 7. **Open Pull Request**
- On GitHub, go to your repo.
- You’ll see a prompt to open a **Pull Request** from your branch → main.
- Review, discuss, and merge once approved.

---

## 📊 Workflow Table

| Step | Command | Purpose |
|------|----------|---------|
| Clone repo | `git clone` | Get local copy |
| Create branch | `git checkout -b branch` | Work separately |
| Sync with main | `git pull origin main` | Stay updated |
| Commit changes | `git commit -m "msg"` | Save work |
| Push branch | `git push origin branch` | Share work |
| Pull Request | GitHub UI | Merge after review |

---

This way, each collaborator works independently in their own branch, pulls the latest main code before starting, and merges only through Pull Requests.  

